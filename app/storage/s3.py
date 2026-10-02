"""S3-compatible object storage backend."""
from __future__ import annotations

import asyncio

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.storage.base import StorageBackend, StorageError, content_disposition


class S3Backend(StorageBackend):
    name = "s3"

    def __init__(
        self,
        *,
        bucket: str,
        endpoint_url: str,
        access_key_id: str,
        secret_access_key: str,
        region: str,
    ):
        self._bucket = bucket
        self._endpoint_url = endpoint_url
        self._access_key_id = access_key_id
        self._secret_access_key = secret_access_key
        self._region = region
        self._client = None

    def _get_client(self):
        if self._client is None:
            self._client = boto3.client(
                "s3",
                endpoint_url=self._endpoint_url or None,
                aws_access_key_id=self._access_key_id or None,
                aws_secret_access_key=self._secret_access_key or None,
                region_name=self._region or None,
            )
        return self._client

    async def put(self, key: str, body: bytes, content_type: str | None = None) -> None:
        kwargs = {"Bucket": self._bucket, "Key": key, "Body": body}
        if content_type:
            kwargs["ContentType"] = content_type
        try:
            await asyncio.to_thread(self._get_client().put_object, **kwargs)
        except (ClientError, BotoCoreError) as exc:
            raise StorageError(f"failed to store key {key!r}") from exc

    async def get(self, key: str) -> bytes:
        try:
            response = await asyncio.to_thread(
                self._get_client().get_object, Bucket=self._bucket, Key=key
            )
        except (ClientError, BotoCoreError) as exc:
            raise StorageError(f"no object at key {key!r}") from exc
        return await asyncio.to_thread(response["Body"].read)

    async def delete(self, key: str) -> None:
        try:
            await asyncio.to_thread(
                self._get_client().delete_object, Bucket=self._bucket, Key=key
            )
        except (ClientError, BotoCoreError) as exc:
            raise StorageError(f"failed to delete key {key!r}") from exc

    async def url_for(
        self, key: str, *, download_name: str | None = None, expires_in: int = 300
    ) -> str | None:
        params: dict[str, str] = {"Bucket": self._bucket, "Key": key}
        if download_name:
            params["ResponseContentDisposition"] = content_disposition(download_name)
        return await asyncio.to_thread(
            self._get_client().generate_presigned_url,
            "get_object",
            Params=params,
            ExpiresIn=max(1, min(int(expires_in), 3600)),
        )
