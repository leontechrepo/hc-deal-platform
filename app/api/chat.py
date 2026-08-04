"""
Credit Co-Pilot chat endpoint. Reuses the anthropic SDK integration pattern
from app/automation/scanner.py (same model, same prompt-caching convention),
grounded in real deal/sponsor/fund/portfolio data via app/domain/chat_context.py.
"""
from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.core.config import settings
from app.db.models import ChatMessage, ChatSession
from app.db.session import get_db
from app.domain.chat_context import build_chat_context

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])

_CHAT_MODEL = "claude-sonnet-4-6"
_MAX_TOKENS = 1024
_HISTORY_LIMIT = 20
_TITLE_MAX_LEN = 40

# Simple in-memory per-user rate limit — resets on redeploy and doesn't hold
# across multiple instances. Acceptable for a single-container deployment;
# revisit with a shared store (e.g. Redis) if this app is ever scaled out.
_RATE_LIMIT_PER_MINUTE = 20
_rate_limit_state: dict[str, list[float]] = {}


def _check_rate_limit(user_sub: str) -> None:
    now = time.monotonic()
    window_start = now - 60
    timestamps = [t for t in _rate_limit_state.get(user_sub, []) if t > window_start]
    if len(timestamps) >= _RATE_LIMIT_PER_MINUTE:
        raise HTTPException(status_code=429, detail="Too many messages — please wait a moment and try again")
    timestamps.append(now)
    _rate_limit_state[user_sub] = timestamps


class ChatRequest(BaseModel):
    session_id: str | None = None
    message: str
    deal_id: int | None = None


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    created_at: str


class ChatSessionOut(BaseModel):
    id: str
    title: str
    deal_id: int | None
    created_at: str
    updated_at: str


class ChatMessageOut(BaseModel):
    role: str
    content: str
    created_at: str


def _derive_title(first_user_message: str | None) -> str:
    if not first_user_message:
        return "New chat"
    text = first_user_message.strip()
    if len(text) <= _TITLE_MAX_LEN:
        return text
    return text[:_TITLE_MAX_LEN].rstrip() + "…"


@router.post("/chat", response_model=ChatResponse)
async def send_chat_message(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Chat is not configured yet")
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="message must not be empty")

    user_sub = auth.get("sub", "unknown")
    _check_rate_limit(user_sub)

    session_id = body.session_id or uuid.uuid4().hex
    session_res = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = session_res.scalar_one_or_none()
    if session and session.user_sub != user_sub:
        # Someone else's session id — never read/continue another user's
        # conversation, and never take over their session row either.
        raise HTTPException(status_code=403, detail="This chat session does not belong to you")
    if not session:
        session = ChatSession(id=session_id, deal_id=body.deal_id, user_sub=user_sub)
        db.add(session)
        await db.flush()
    else:
        if body.deal_id and session.deal_id != body.deal_id:
            session.deal_id = body.deal_id
        session.updated_at = datetime.now(timezone.utc)

    history_res = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(_HISTORY_LIMIT)
    )
    history = list(reversed(history_res.scalars().all()))

    system_prompt = await build_chat_context(db, body.deal_id)

    import anthropic
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    messages = [{"role": m.role, "content": m.content} for m in history]
    messages.append({"role": "user", "content": body.message})

    try:
        response = client.messages.create(
            model=_CHAT_MODEL,
            max_tokens=_MAX_TOKENS,
            system=[{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}],
            messages=messages,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Chat model error: {exc}")

    reply_text = "".join(block.text for block in response.content if getattr(block, "type", None) == "text").strip()
    if not reply_text:
        reply_text = "I wasn't able to generate a response — please try rephrasing."

    db.add(ChatMessage(session_id=session_id, role="user", content=body.message))
    db.add(ChatMessage(
        session_id=session_id, role="assistant", content=reply_text,
        input_tokens=getattr(response.usage, "input_tokens", None),
        output_tokens=getattr(response.usage, "output_tokens", None),
    ))

    return ChatResponse(session_id=session_id, reply=reply_text, created_at=datetime.now(timezone.utc).isoformat())


async def _get_owned_session(db: AsyncSession, session_id: str, user_sub: str) -> ChatSession:
    res = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    if session.user_sub != user_sub:
        raise HTTPException(status_code=403, detail="This chat session does not belong to you")
    return session


@router.get("/chat/sessions", response_model=list[ChatSessionOut])
async def list_chat_sessions(
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    user_sub = auth.get("sub", "unknown")

    first_user_message = (
        select(ChatMessage.session_id, ChatMessage.content)
        .distinct(ChatMessage.session_id)
        .where(ChatMessage.role == "user")
        .order_by(ChatMessage.session_id, ChatMessage.created_at.asc())
        .subquery()
    )

    res = await db.execute(
        select(ChatSession, first_user_message.c.content)
        .outerjoin(first_user_message, first_user_message.c.session_id == ChatSession.id)
        .where(ChatSession.user_sub == user_sub)
        .order_by(ChatSession.updated_at.desc())
    )

    return [
        ChatSessionOut(
            id=session.id,
            title=_derive_title(first_message),
            deal_id=session.deal_id,
            created_at=session.created_at.isoformat(),
            updated_at=session.updated_at.isoformat(),
        )
        for session, first_message in res.all()
    ]


@router.get("/chat/sessions/{session_id}/messages", response_model=list[ChatMessageOut])
async def get_chat_session_messages(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    user_sub = auth.get("sub", "unknown")
    await _get_owned_session(db, session_id, user_sub)

    res = await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc())
    )
    return [
        ChatMessageOut(role=m.role, content=m.content, created_at=m.created_at.isoformat())
        for m in res.scalars().all()
    ]


@router.delete("/chat/sessions/{session_id}", status_code=204)
async def delete_chat_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    user_sub = auth.get("sub", "unknown")
    session = await _get_owned_session(db, session_id, user_sub)
    await db.delete(session)
