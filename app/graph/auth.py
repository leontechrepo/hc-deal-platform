"""Microsoft Graph client-credentials auth with an in-process token cache."""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
SCOPE = "https://graph.microsoft.com/.default"
_EXPIRY_SKEW = timedelta(minutes=5)

_cache: "_CachedToken | None" = None
_lock = asyncio.Lock()


@dataclass(frozen=True)
class _CachedToken:
    token: str
    expires_at: datetime


def reset_token_cache() -> None:
    global _cache
    _cache = None


async def get_access_token(
    client: httpx.AsyncClient, *, force_refresh: bool = False
) -> str:
    global _cache

    now = datetime.now(timezone.utc)
    if not force_refresh and _cache and _cache.expires_at > now:
        return _cache.token

    async with _lock:
        now = datetime.now(timezone.utc)
        if not force_refresh and _cache and _cache.expires_at > now:
            return _cache.token

        if not (
            settings.AZURE_TENANT_ID
            and settings.AZURE_CLIENT_ID
            and settings.AZURE_CLIENT_SECRET
        ):
            raise RuntimeError(
                "Microsoft Graph is not configured — set AZURE_TENANT_ID, "
                "AZURE_CLIENT_ID and AZURE_CLIENT_SECRET"
            )

        response = await client.post(
            TOKEN_URL.format(tenant=settings.AZURE_TENANT_ID),
            data={
                "grant_type": "client_credentials",
                "client_id": settings.AZURE_CLIENT_ID,
                "client_secret": settings.AZURE_CLIENT_SECRET,
                "scope": SCOPE,
            },
        )
        response.raise_for_status()
        payload = response.json()

        expires_in = int(payload.get("expires_in", 3600))
        _cache = _CachedToken(
            token=payload["access_token"],
            expires_at=datetime.now(timezone.utc)
            + timedelta(seconds=expires_in)
            - _EXPIRY_SKEW,
        )
        logger.info("Graph token acquired, valid for %ss", expires_in)
        return _cache.token
