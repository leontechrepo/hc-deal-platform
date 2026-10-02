from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://leon:leon@localhost:5432/hc_deals"

    AZURE_TENANT_ID: str = ""
    AZURE_CLIENT_ID: str = ""
    AZURE_CLIENT_SECRET: str = ""

    MONITORED_USER_1: str = ""
    MONITORED_USER_2: str = ""
    INTERNAL_EMAIL_DOMAINS: str = ""

    ANTHROPIC_API_KEY: str = ""
    CLASSIFIER_MODEL: str = "claude-sonnet-4-6"
    EXTRACTION_MODEL: str = "claude-sonnet-4-6"
    EXTRACTION_TIMEOUT_SECONDS: float = 120.0

    CLERK_JWKS_URL: str = ""
    SCAN_INTERVAL_MINUTES: int = 240
    GRAPH_FOLDERS: str = "inbox,sentitems"
    ATTACHMENT_INGESTION_ENABLED: bool = False
    DOCUMENT_EXTRACTION_ENABLED: bool = False

    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: str = ""
    AZURE_DOCUMENT_INTELLIGENCE_KEY: str = ""

    # Document storage. `local` needs no credentials; `s3` uses Railway vars.
    STORAGE_BACKEND: str = "s3"
    STORAGE_LOCAL_PATH: str = "./storage"
    STORAGE_BUCKET_NAME: str = ""
    STORAGE_ENDPOINT_URL: str = ""
    STORAGE_ACCESS_KEY_ID: str = ""
    STORAGE_SECRET_ACCESS_KEY: str = ""
    STORAGE_REGION: str = "auto"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def storage_configured(self) -> bool:
        if self.STORAGE_BACKEND == "local":
            return True
        return bool(
            self.STORAGE_BUCKET_NAME
            and self.STORAGE_ENDPOINT_URL
            and self.STORAGE_ACCESS_KEY_ID
            and self.STORAGE_SECRET_ACCESS_KEY
        )

    @property
    def monitored_users(self) -> list[str]:
        return [u for u in [self.MONITORED_USER_1, self.MONITORED_USER_2] if u]

    @property
    def internal_email_domains(self) -> frozenset[str]:
        return frozenset(
            d.strip().lower()
            for d in self.INTERNAL_EMAIL_DOMAINS.split(",")
            if d.strip()
        )

    @property
    def graph_folders(self) -> list[str]:
        return [f.strip() for f in self.GRAPH_FOLDERS.split(",") if f.strip()]

    @property
    def document_extraction_enabled(self) -> bool:
        return self.DOCUMENT_EXTRACTION_ENABLED and self.ATTACHMENT_INGESTION_ENABLED


settings = Settings()
