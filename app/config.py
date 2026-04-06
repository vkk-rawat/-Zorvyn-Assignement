from __future__ import annotations

import json
from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Finance Data Processing and Access Control API"
    app_version: str = "1.0.0"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./finance_data.db"
    jwt_secret_key: str = "please-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7
    cors_origins_raw: str = Field(default="*", validation_alias="CORS_ORIGINS")
    auto_create_tables: bool = True
    bootstrap_admin_enabled: bool = False
    bootstrap_admin_name: str = "System Admin"
    bootstrap_admin_email: Optional[str] = None
    bootstrap_admin_password: Optional[str] = None
    login_rate_limit_requests: int = 10
    login_rate_limit_window_seconds: int = 60

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        raw_value = self.cors_origins_raw.strip()
        if not raw_value:
            return []

        if raw_value.startswith("["):
            try:
                parsed_value = json.loads(raw_value)
            except json.JSONDecodeError:
                pass
            else:
                if isinstance(parsed_value, list):
                    return [
                        str(origin).strip()
                        for origin in parsed_value
                        if str(origin).strip()
                    ]

        return [origin.strip() for origin in raw_value.split(",") if origin.strip()]

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()
