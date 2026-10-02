"""Authenticated Graph requests with retry, backoff and token refresh."""
from __future__ import annotations

import asyncio
import logging
import random
from typing import Any

import httpx

from app.graph.auth import get_access_token

logger = logging.getLogger(__name__)

RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})
MAX_RETRY_AFTER_SECONDS = 120.0
BASE_BACKOFF_SECONDS = 1.0


class GraphError(RuntimeError):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(f"Graph {status_code}: {message}")
        self.status_code = status_code
        self.message = message


class DeltaTokenExpired(GraphError):
    """Graph returned 410 Gone — stored delta link is too old to resume."""


def _retry_after_seconds(response: httpx.Response, attempt: int) -> float:
    header = response.headers.get("Retry-After")
    if header:
        try:
            return min(float(header), MAX_RETRY_AFTER_SECONDS)
        except ValueError:
            pass
    backoff = BASE_BACKOFF_SECONDS * (2 ** attempt)
    return min(backoff + random.uniform(0, 0.5), MAX_RETRY_AFTER_SECONDS)


async def graph_request(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    max_attempts: int = 5,
    sleep=asyncio.sleep,
) -> httpx.Response:
    refreshed = False

    for attempt in range(max_attempts):
        token = await get_access_token(client)
        request_headers = {"Authorization": f"Bearer {token}", **(headers or {})}
        response = await client.request(
            method, url, params=params, headers=request_headers
        )

        if response.status_code < 400:
            return response

        if response.status_code == 401 and not refreshed:
            logger.warning("Graph 401; refreshing token and retrying once")
            refreshed = True
            await get_access_token(client, force_refresh=True)
            continue

        if response.status_code == 410:
            raise DeltaTokenExpired(410, "delta token expired; resync required")

        if response.status_code in RETRY_STATUSES and attempt < max_attempts - 1:
            delay = _retry_after_seconds(response, attempt)
            logger.warning(
                "Graph %s on %s; retrying in %.1fs (attempt %d/%d)",
                response.status_code, url, delay, attempt + 1, max_attempts,
            )
            await sleep(delay)
            continue

        raise GraphError(response.status_code, response.text[:500])

    raise GraphError(0, f"exhausted {max_attempts} attempts for {url}")
