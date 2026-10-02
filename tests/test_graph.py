"""Unit tests for Graph HTTP retry / 410 handling."""
from __future__ import annotations

import httpx
import pytest

from app.graph.http import DeltaTokenExpired, GraphError, graph_request


class _FakeResponse:
    def __init__(self, status_code: int, text: str = "", headers: dict | None = None):
        self.status_code = status_code
        self.text = text
        self.headers = headers or {}
        self._json = {}

    def json(self):
        return self._json


class _FakeClient:
    def __init__(self, responses: list[_FakeResponse]):
        self._responses = list(responses)
        self.calls = 0

    async def request(self, method, url, params=None, headers=None):
        self.calls += 1
        if not self._responses:
            raise AssertionError("no more responses")
        return self._responses.pop(0)


@pytest.mark.asyncio
async def test_graph_request_retries_429(monkeypatch):
    sleeps: list[float] = []

    async def fake_sleep(delay):
        sleeps.append(delay)

    async def fake_token(client, force_refresh=False):
        return "tok"

    monkeypatch.setattr("app.graph.http.get_access_token", fake_token)

    client = _FakeClient([
        _FakeResponse(429, "slow", {"Retry-After": "0"}),
        _FakeResponse(200, "ok"),
    ])
    resp = await graph_request(
        client, "GET", "https://example/graph", sleep=fake_sleep, max_attempts=3
    )
    assert resp.status_code == 200
    assert client.calls == 2
    assert sleeps


@pytest.mark.asyncio
async def test_graph_410_raises_delta_expired(monkeypatch):
    async def fake_token(client, force_refresh=False):
        return "tok"

    monkeypatch.setattr("app.graph.http.get_access_token", fake_token)
    client = _FakeClient([_FakeResponse(410, "gone")])
    with pytest.raises(DeltaTokenExpired):
        await graph_request(client, "GET", "https://example/graph", max_attempts=2)


@pytest.mark.asyncio
async def test_graph_non_retryable_error(monkeypatch):
    async def fake_token(client, force_refresh=False):
        return "tok"

    monkeypatch.setattr("app.graph.http.get_access_token", fake_token)
    client = _FakeClient([_FakeResponse(400, "bad")])
    with pytest.raises(GraphError) as exc:
        await graph_request(client, "GET", "https://example/graph", max_attempts=2)
    assert exc.value.status_code == 400
