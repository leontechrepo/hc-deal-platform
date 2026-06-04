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

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def monitored_users(self) -> list[str]:
        return [u for u in [self.MONITORED_USER_1, self.MONITORED_USER_2] if u]


settings = Settings()
