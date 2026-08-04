"""
Regression test for the Codex-review finding on app/api/chat.py: a chat
session lookup must be scoped to the authenticated caller, not just the
session id, or one user could read/continue another user's conversation.
"""
from unittest.mock import MagicMock, patch

import pytest

from app.api.chat import (
    ChatRequest,
    delete_chat_session,
    get_chat_session_messages,
    list_chat_sessions,
    send_chat_message,
)
import app.api.chat as chat_mod


def _fake_anthropic_response(text="ok"):
    fake_block = MagicMock(type="text", text=text)
    fake_usage = MagicMock(input_tokens=10, output_tokens=5)
    return MagicMock(content=[fake_block], usage=fake_usage)


async def test_chat_session_scoped_to_owning_user(db_session):
    chat_mod.settings.ANTHROPIC_API_KEY = "fake-key-for-test"

    with patch("anthropic.Anthropic") as MockClient:
        MockClient.return_value.messages.create.return_value = _fake_anthropic_response("hello from A")
        res = await send_chat_message(ChatRequest(message="hi"), db_session, {"sub": "user-a"})
        session_id = res.session_id

    with patch("anthropic.Anthropic") as MockClient:
        MockClient.return_value.messages.create.return_value = _fake_anthropic_response("should not be seen")
        with pytest.raises(Exception) as exc_info:
            await send_chat_message(
                ChatRequest(session_id=session_id, message="what did user A say?"),
                db_session,
                {"sub": "user-b"},
            )
        assert getattr(exc_info.value, "status_code", None) == 403

    with patch("anthropic.Anthropic") as MockClient:
        MockClient.return_value.messages.create.return_value = _fake_anthropic_response("hello again to A")
        res2 = await send_chat_message(
            ChatRequest(session_id=session_id, message="follow up"), db_session, {"sub": "user-a"}
        )
        assert res2.session_id == session_id


async def test_list_sessions_scoped_to_owning_user(db_session):
    chat_mod.settings.ANTHROPIC_API_KEY = "fake-key-for-test"

    with patch("anthropic.Anthropic") as MockClient:
        MockClient.return_value.messages.create.return_value = _fake_anthropic_response("reply")
        res = await send_chat_message(
            ChatRequest(message="What's our largest active deal?"), db_session, {"sub": "user-a"}
        )
        session_id = res.session_id

    sessions_a = await list_chat_sessions(db_session, {"sub": "user-a"})
    assert len(sessions_a) == 1
    assert sessions_a[0].id == session_id
    assert sessions_a[0].title == "What's our largest active deal?"

    sessions_b = await list_chat_sessions(db_session, {"sub": "user-b"})
    assert sessions_b == []


async def test_get_session_messages_ownership(db_session):
    chat_mod.settings.ANTHROPIC_API_KEY = "fake-key-for-test"

    with patch("anthropic.Anthropic") as MockClient:
        MockClient.return_value.messages.create.return_value = _fake_anthropic_response("hello from A")
        res = await send_chat_message(ChatRequest(message="hi"), db_session, {"sub": "user-a"})
        session_id = res.session_id

    messages = await get_chat_session_messages(session_id, db_session, {"sub": "user-a"})
    assert [m.role for m in messages] == ["user", "assistant"]
    assert messages[0].content == "hi"
    assert messages[1].content == "hello from A"

    with pytest.raises(Exception) as exc_info:
        await get_chat_session_messages(session_id, db_session, {"sub": "user-b"})
    assert getattr(exc_info.value, "status_code", None) == 403

    with pytest.raises(Exception) as exc_info:
        await get_chat_session_messages("does-not-exist", db_session, {"sub": "user-a"})
    assert getattr(exc_info.value, "status_code", None) == 404


async def test_delete_session_removes_messages(db_session):
    chat_mod.settings.ANTHROPIC_API_KEY = "fake-key-for-test"

    with patch("anthropic.Anthropic") as MockClient:
        MockClient.return_value.messages.create.return_value = _fake_anthropic_response("hello from A")
        res = await send_chat_message(ChatRequest(message="hi"), db_session, {"sub": "user-a"})
        session_id = res.session_id

    with pytest.raises(Exception) as exc_info:
        await delete_chat_session(session_id, db_session, {"sub": "user-b"})
    assert getattr(exc_info.value, "status_code", None) == 403

    await delete_chat_session(session_id, db_session, {"sub": "user-a"})

    with pytest.raises(Exception) as exc_info:
        await get_chat_session_messages(session_id, db_session, {"sub": "user-a"})
    assert getattr(exc_info.value, "status_code", None) == 404
