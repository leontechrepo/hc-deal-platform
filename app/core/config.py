from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://leon:leon@localhost:5432/hc_deals"

    AZURE_TENANT_ID: str = ""
    AZURE_CLIENT_ID: str = ""
    AZURE_CLIENT_SECRET: str = ""

    MONITORED_USER_1: str = ""
    MONITORED_USER_2: str = ""

    ANTHROPIC_API_KEY: str = ""

    CLERK_JWKS_URL: str = ""
    SCAN_INTERVAL_MINUTES: int = 240

    # Railway's native S3-compatible object storage bucket, used for deal
    # document uploads (app/storage/documents.py). Left empty in local dev —
    # document metadata still works, uploads/downloads 503 until configured.
    STORAGE_BUCKET_NAME: str = ""
    STORAGE_ENDPOINT_URL: str = ""
    STORAGE_ACCESS_KEY_ID: str = ""
    STORAGE_SECRET_ACCESS_KEY: str = ""
    STORAGE_REGION: str = "auto"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def storage_configured(self) -> bool:
        return bool(
            self.STORAGE_BUCKET_NAME
            and self.STORAGE_ENDPOINT_URL
            and self.STORAGE_ACCESS_KEY_ID
            and self.STORAGE_SECRET_ACCESS_KEY
        )

    @property
    def monitored_users(self) -> list[str]:
        return [u for u in [self.MONITORED_USER_1, self.MONITORED_USER_2] if u]


settings = Settings()
