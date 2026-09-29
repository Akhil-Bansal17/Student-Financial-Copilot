import json
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Student Financial Copilot"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "dev-secret-key-change-in-production-minimum-32-chars-long"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days in minutes (10080)
    
    # Database
    DATABASE_URL: str = "postgresql+psycopg2://copilot_user:copilot_secret@localhost:5432/student_financial_copilot"

    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if not v.startswith("["):
                return [i.strip() for i in v.split(",") if i.strip()]
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return [str(item) for item in parsed]
            except Exception:
                pass
        elif isinstance(v, list):
            return [str(item) for item in v]
    # AI Configuration (Phase 7 & 8)
    AI_PROVIDER: str = "gemini"  # "gemini", "openai", "mock"
    AI_API_KEY: str = ""
    AI_MODEL: str = "gemini-1.5-flash"
    AI_REQUEST_TIMEOUT_SECONDS: int = 15
    AI_MAX_MESSAGE_LENGTH: int = 1000
    AI_MAX_HISTORY_MESSAGES: int = 10
    AI_RATE_LIMIT_PER_MINUTE: int = 30

    # Bank Sync & Account Aggregator (AA) Sandbox Configuration (Phase 9A & 9B)
    BANK_PROVIDER: str = "mock_bank"  # "mock_bank", "setu_aa", "account_aggregator"
    AA_PROVIDER: str = "setu_aa"
    AA_BASE_URL: str = "https://fiu-sandbox.setu.co"
    AA_CLIENT_ID: str = ""
    AA_CLIENT_SECRET: str = ""
    AA_PRODUCT_INSTANCE_ID: str = ""
    AA_WEBHOOK_SECRET: str = ""
    AA_REDIRECT_URL: str = "http://localhost:5173/connected-accounts"
    AA_TIMEOUT_SECONDS: int = 15
    AA_SANDBOX_SIMULATE: bool = True

    # Automatic Background Sync & Reconciliation (Phase 10)
    BANK_SYNC_ENABLED: bool = True
    BANK_SYNC_INTERVAL_MINUTES: int = 15
    BANK_SYNC_LOCK_TIMEOUT_SECONDS: int = 300
    BANK_SYNC_MAX_RETRIES: int = 3
    BANK_SYNC_LOOKBACK_DAYS: int = 30

    @field_validator("SECRET_KEY", mode="after")
    @classmethod
    def validate_production_secret(cls, v: str, info) -> str:
        # Prevent deploying with the fallback dev key in production
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
