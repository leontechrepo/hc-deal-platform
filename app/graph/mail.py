from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from app.graph.auth import get_access_token

GRAPH_BASE = "https://graph.microsoft.com/v1.0"


async def fetch_messages_since(
    user_email: str,
    since: datetime,
    client: httpx.AsyncClient,
) -> list[dict[str, Any]]:
    token = await get_access_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    since_str = since.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    params = {
        "$filter": f"receivedDateTime ge {since_str}",
        "$select": "id,subject,bodyPreview,from,receivedDateTime,body,conversationId",
        "$orderby": "receivedDateTime desc",
        "$top": "50",
    }

    messages = []
    url = f"{GRAPH_BASE}/users/{user_email}/messages"

    while url:
        resp = await client.get(url, headers=headers, params=params if "?" not in url else None)
        resp.raise_for_status()
        data = resp.json()
        messages.extend(data.get("value", []))
        url = data.get("@odata.nextLink")

    return messages
