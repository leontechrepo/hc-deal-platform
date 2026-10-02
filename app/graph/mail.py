"""Reading mail from Microsoft Graph via delta queries."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import httpx

from app.graph.http import graph_request

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"

MESSAGE_SELECT = (
    "id,internetMessageId,conversationId,subject,bodyPreview,uniqueBody,body,"
    "from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,"
    "hasAttachments,isDraft,changeKey"
)

DEFAULT_PAGE_SIZE = 50


def mail_headers(page_size: int = DEFAULT_PAGE_SIZE) -> dict[str, str]:
    return {
        "Prefer": f'outlook.body-content-type="text", odata.maxpagesize={page_size}'
    }


@dataclass(frozen=True)
class DeltaPage:
    messages: list[dict[str, Any]] = field(default_factory=list)
    removed_ids: list[str] = field(default_factory=list)
    next_link: str | None = None
    delta_link: str | None = None

    @property
    def is_final(self) -> bool:
        return self.delta_link is not None


def initial_delta_url(
    user_email: str, folder: str, *, since: datetime | None = None
) -> str:
    url = (
        f"{GRAPH_BASE}/users/{user_email}/mailFolders/{folder}/messages/delta"
        f"?$select={MESSAGE_SELECT}"
    )
    if since is not None:
        url += f"&$filter=receivedDateTime+ge+{since.strftime('%Y-%m-%dT%H:%M:%SZ')}"
    return url


def _parse_delta_payload(payload: dict[str, Any]) -> DeltaPage:
    messages: list[dict[str, Any]] = []
    removed: list[str] = []
    for item in payload.get("value", []):
        if "@removed" in item:
            if item.get("id"):
                removed.append(item["id"])
        else:
            messages.append(item)

    return DeltaPage(
        messages=messages,
        removed_ids=removed,
        next_link=payload.get("@odata.nextLink"),
        delta_link=payload.get("@odata.deltaLink"),
    )


async def fetch_delta_page(
    client: httpx.AsyncClient, *, url: str, page_size: int = DEFAULT_PAGE_SIZE
) -> DeltaPage:
    response = await graph_request(
        client, "GET", url, headers=mail_headers(page_size)
    )
    return _parse_delta_payload(response.json())


async def fetch_message(
    client: httpx.AsyncClient, *, user_email: str, message_id: str
) -> dict[str, Any] | None:
    """Re-read one message (used to re-drive orphaned claims). None if it is gone."""
    from app.graph.http import GraphError

    try:
        response = await graph_request(
            client, "GET",
            f"{GRAPH_BASE}/users/{user_email}/messages/{message_id}?$select={MESSAGE_SELECT}",
            headers=mail_headers(),
        )
    except GraphError as exc:
        if exc.status_code == 404:
            return None
        raise
    return response.json()


async def fetch_messages_since(
    client: httpx.AsyncClient,
    *,
    user_email: str,
    folder: str = "inbox",
    since: datetime,
    limit: int | None = None,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> list[dict[str, Any]]:
    """Time-window read for seeding/backfill — never touches the delta watermark.

    Signature accepts keyword-style call from the new scanner. A thin compatibility
    wrapper below preserves the old positional `fetch_messages_since(user, since, client)`.
    """
    url = f"{GRAPH_BASE}/users/{user_email}/mailFolders/{folder}/messages"
    params: dict[str, Any] | None = {
        "$filter": f"receivedDateTime ge {since.strftime('%Y-%m-%dT%H:%M:%SZ')}",
        "$select": MESSAGE_SELECT,
        "$orderby": "receivedDateTime desc",
        "$top": str(page_size),
    }

    collected: list[dict[str, Any]] = []
    while url:
        response = await graph_request(
            client, "GET", url,
            params=params if "?" not in url else None,
            headers=mail_headers(page_size),
        )
        payload = response.json()
        collected.extend(payload.get("value", []))
        if limit is not None and len(collected) >= limit:
            return collected[:limit]
        url = payload.get("@odata.nextLink")
        params = None

    return collected
