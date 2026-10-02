"""Reading attachments from Microsoft Graph."""
from __future__ import annotations

import base64
import logging
from typing import Any

import httpx

from app.graph.http import graph_request
from app.graph.mail import GRAPH_BASE

logger = logging.getLogger(__name__)

ATTACHMENT_SELECT = "id,name,contentType,size,isInline"


async def list_attachments(
    client: httpx.AsyncClient, *, user_email: str, message_id: str
) -> list[dict[str, Any]]:
    response = await graph_request(
        client,
        "GET",
        f"{GRAPH_BASE}/users/{user_email}/messages/{message_id}/attachments",
        params={"$select": ATTACHMENT_SELECT},
    )
    return response.json().get("value", [])


async def fetch_attachment_bytes(
    client: httpx.AsyncClient,
    *,
    user_email: str,
    message_id: str,
    attachment_id: str,
) -> bytes | None:
    url = (
        f"{GRAPH_BASE}/users/{user_email}/messages/{message_id}"
        f"/attachments/{attachment_id}/$value"
    )
    try:
        response = await graph_request(client, "GET", url)
        return response.content
    except Exception as exc:  # noqa: BLE001
        logger.info("Attachment /$value unavailable (%s); trying contentBytes", exc)

    response = await graph_request(
        client,
        "GET",
        f"{GRAPH_BASE}/users/{user_email}/messages/{message_id}"
        f"/attachments/{attachment_id}",
        params={"$select": "contentBytes"},
    )
    encoded = response.json().get("contentBytes")
    return base64.b64decode(encoded) if encoded else None
