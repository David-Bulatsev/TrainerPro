from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from pydantic_settings import BaseSettings, SettingsConfigDict


def _load_dotenv_if_present() -> None:
    """
    Minimal .env loader.
    We don't depend on python-dotenv; instead we parse KEY=VALUE lines.
    """

    # storage.py: backend/app/core/storage.py -> parents[2] == backend/
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return

    try:
        content = env_path.read_text(encoding="utf-8")
    except Exception:
        return

    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv_if_present()


class StorageSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="STORAGE_", extra="ignore")

    backend: str = "s3"

    s3_endpoint_url: Optional[str] = None
    # Endpoint that will be embedded into pre-signed URLs (must be reachable from browser).
    s3_public_endpoint_url: Optional[str] = None
    s3_access_key_id: Optional[str] = None
    s3_secret_access_key: Optional[str] = None
    s3_region: str = "us-east-1"
    s3_bucket: Optional[str] = None

    # Default: 1 hour.
    presign_expires_seconds: int = 3600

    # Upload restrictions.
    max_file_size_bytes: int = 10 * 1024 * 1024  # 10MB


@dataclass(frozen=True)
class PresignResult:
    url: str


class StorageError(RuntimeError):
    pass


def _require(value: Optional[str], name: str) -> str:
    if not value:
        raise StorageError(f"Missing required storage setting: {name}")
    return value


class S3Storage:
    def __init__(self, settings: StorageSettings):
        bucket = _require(settings.s3_bucket, "STORAGE_S3_BUCKET")
        access_key_id = _require(settings.s3_access_key_id, "STORAGE_S3_ACCESS_KEY_ID")
        secret_access_key = _require(settings.s3_secret_access_key, "STORAGE_S3_SECRET_ACCESS_KEY")
        endpoint_url = _require(settings.s3_endpoint_url, "STORAGE_S3_ENDPOINT_URL")
        public_endpoint_url = settings.s3_public_endpoint_url or endpoint_url

        self._settings = settings
        self._bucket = bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name=settings.s3_region,
        )
        # Use a separate client for presigning, so URLs contain public hostname.
        self._public_client = boto3.client(
            "s3",
            endpoint_url=public_endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name=settings.s3_region,
        )

    @property
    def max_file_size_bytes(self) -> int:
        return int(self._settings.max_file_size_bytes)

    @property
    def bucket(self) -> str:
        return self._bucket

    def upload_bytes(
        self, *, key: str, content: bytes, content_type: Optional[str], content_length: int
    ) -> None:
        try:
            extra_args = {}
            if content_type:
                extra_args["ContentType"] = content_type
            self._client.put_object(
                Bucket=self._bucket,
                Key=key,
                Body=content,
                ContentLength=content_length,
                **extra_args,
            )
        except (BotoCoreError, ClientError) as e:
            raise StorageError(f"S3 upload failed: {e}") from e

    def generate_presigned_download_url(self, *, key: str) -> PresignResult:
        try:
            url = self._public_client.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": self._bucket, "Key": key},
                ExpiresIn=self._settings.presign_expires_seconds,
            )
            return PresignResult(url=url)
        except (BotoCoreError, ClientError) as e:
            raise StorageError(f"Presign failed: {e}") from e

    def delete_object(self, *, key: str) -> None:
        try:
            self._client.delete_object(Bucket=self._bucket, Key=key)
        except (BotoCoreError, ClientError) as e:
            raise StorageError(f"S3 delete failed: {e}") from e


def get_storage(settings: Optional[StorageSettings] = None) -> S3Storage:
    s = settings or StorageSettings()
    if s.backend != "s3":
        raise StorageError(f"Unsupported storage backend: {s.backend}")
    return S3Storage(s)

