"""
Test Microsoft Graph connectivity for both monitored inboxes.

Usage:
    conda activate hc-deal-platform
    python scripts/test_graph.py

Checks:
  1. Azure token acquisition (client credentials)
  2. Read 1 message from MONITORED_USER_1
  3. Read 1 message from MONITORED_USER_2
"""
import asyncio
import os
import sys
from pathlib import Path

# Allow running from project root
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

import httpx

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"


def _check_env() -> bool:
    missing = []
    for var in ("AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET",
                "MONITORED_USER_1", "MONITORED_USER_2"):
        val = os.getenv(var, "")
        if not val or val.startswith("your-"):
            missing.append(var)
    if missing:
        print(f"[SKIP] Missing or placeholder env vars: {', '.join(missing)}")
        print("       Fill in .env with real Azure credentials first.")
        return False
    return True


async def get_token(client: httpx.AsyncClient) -> str:
    tenant = os.environ["AZURE_TENANT_ID"]
    resp = await client.post(
        TOKEN_URL.format(tenant=tenant),
        data={
            "grant_type": "client_credentials",
            "client_id": os.environ["AZURE_CLIENT_ID"],
            "client_secret": os.environ["AZURE_CLIENT_SECRET"],
            "scope": "https://graph.microsoft.com/.default",
        },
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Token request failed {resp.status_code}: {resp.text}")
    return resp.json()["access_token"]


async def test_inbox(user_email: str, token: str, client: httpx.AsyncClient) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get(
        f"{GRAPH_BASE}/users/{user_email}/messages",
        headers=headers,
        params={
            "$top": "1",
            "$select": "id,subject,from,receivedDateTime",
            "$orderby": "receivedDateTime desc",
        },
    )
    if resp.status_code == 200:
        messages = resp.json().get("value", [])
        if messages:
            msg = messages[0]
            return {
                "ok": True,
                "subject": msg.get("subject", "(no subject)"),
                "from": (msg.get("from") or {}).get("emailAddress", {}).get("address", "?"),
                "received": msg.get("receivedDateTime", "?"),
            }
        return {"ok": True, "subject": "(mailbox empty)", "from": "", "received": ""}
    return {"ok": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}


async def main() -> None:
    print("=" * 60)
    print("  Microsoft Graph Connectivity Test")
    print("=" * 60)

    if not _check_env():
        sys.exit(0)

    user1 = os.environ["MONITORED_USER_1"]
    user2 = os.environ["MONITORED_USER_2"]

    async with httpx.AsyncClient(timeout=15) as client:
        # Step 1: Get token
        print("\n[1] Acquiring Azure access token...")
        try:
            token = await get_token(client)
            print(f"    ✓ Token acquired (length: {len(token)})")
        except Exception as e:
            print(f"    ✗ FAILED: {e}")
            sys.exit(1)

        # Step 2: Test inbox 1
        print(f"\n[2] Reading inbox: {user1}")
        result1 = await test_inbox(user1, token, client)
        if result1["ok"]:
            print(f"    ✓ Access granted")
            if result1["subject"] != "(mailbox empty)":
                print(f"    Latest email: \"{result1['subject']}\"")
                print(f"    From: {result1['from']}")
                print(f"    Received: {result1['received']}")
        else:
            print(f"    ✗ FAILED: {result1['error']}")

        # Step 3: Test inbox 2
        print(f"\n[3] Reading inbox: {user2}")
        result2 = await test_inbox(user2, token, client)
        if result2["ok"]:
            print(f"    ✓ Access granted")
            if result2["subject"] != "(mailbox empty)":
                print(f"    Latest email: \"{result2['subject']}\"")
                print(f"    From: {result2['from']}")
                print(f"    Received: {result2['received']}")
        else:
            print(f"    ✗ FAILED: {result2['error']}")

    print("\n" + "=" * 60)
    both_ok = result1["ok"] and result2["ok"]
    if both_ok:
        print("  All checks passed — Graph integration is ready.")
    else:
        print("  Some checks failed. Common fixes:")
        print("  - Azure app needs Mail.Read (Application) permission")
        print("  - Admin must grant consent in Azure Portal")
        print("  - User email must match a licensed M365 account")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
