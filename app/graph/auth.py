import httpx

from app.core.config import settings

_TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
_SCOPE = "https://graph.microsoft.com/.default"


async def get_access_token(client: httpx.AsyncClient) -> str:
    url = _TOKEN_URL.format(tenant=settings.AZURE_TENANT_ID)
    resp = await client.post(
        url,
        data={
            "grant_type": "client_credentials",
            "client_id": settings.AZURE_CLIENT_ID,
            "client_secret": settings.AZURE_CLIENT_SECRET,
            "scope": _SCOPE,
        },
    )
    resp.raise_for_status()
    return resp.json()["access_token"]
