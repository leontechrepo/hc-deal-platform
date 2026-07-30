"""
Regression test for the Codex-review finding on app/api/chat.py: a chat
session lookup must be scoped to the authenticated caller, not just the
session id, or one user could read/continue another user's conversation.
"""
from unittest.mock import MagicMock, patch

import pytest

from app.api.chat import ChatRequest, send_chat_message
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
