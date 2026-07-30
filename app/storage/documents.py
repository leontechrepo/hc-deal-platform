"""
Presigned-URL access to Railway's S3-compatible object storage bucket for deal
document uploads. Only metadata (storage_key, size_bytes, ...) lives in
Postgres — raw bytes never pass through the API process.
"""
from __future__ import annotations

import uuid

from app.core.config import settings

_client = None


def _get_client():
    global _client
    if _client is None:
        import boto3

        _client = boto3.client(
            "s3",
            endpoint_url=settings.STORAGE_ENDPOINT_URL,
            aws_access_key_id=settings.STORAGE_ACCESS_KEY_ID,
            aws_secret_access_key=settings.STORAGE_SECRET_ACCESS_KEY,
            region_name=settings.STORAGE_REGION,
        )
    return _client


def make_storage_key(deal_id: int, filename: str) -> str:
    return f"deals/{deal_id}/{uuid.uuid4().hex}-{filename}"


def put_object(storage_key: str, body: bytes, content_type: str | None) -> None:
    kwargs = {"Bucket": settings.STORAGE_BUCKET_NAME, "Key": storage_key, "Body": body}
    if content_type:
        kwargs["ContentType"] = content_type
    _get_client().put_object(**kwargs)


def presigned_get_url(storage_key: str, expires_in: int = 300) -> str:
    return _get_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.STORAGE_BUCKET_NAME, "Key": storage_key},
        ExpiresIn=expires_in,
    )


def delete_object(storage_key: str) -> None:
    _get_client().delete_object(Bucket=settings.STORAGE_BUCKET_NAME, Key=storage_key)
