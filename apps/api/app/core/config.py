import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[3]

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict

    class Settings(BaseSettings):
        model_config = SettingsConfigDict(
            env_file=str(BASE_DIR / ".env"),
            env_file_encoding="utf-8",
            extra="ignore"
        )

        API_HOST: str = "0.0.0.0"
        API_PORT: int = 8000
        API_V1_PREFIX: str = "/api/v1"
        ENVIRONMENT: str = "development"
        LOG_LEVEL: str = "info"
        SECRET_KEY: str = "frameforge-secret-key-production-ready-2026"
        ALGORITHM: str = "HS256"
        ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 14  # 14 days

        # Database
        DATABASE_URL: str = os.environ.get(
            "DATABASE_URL",
            f"sqlite+aiosqlite:///{BASE_DIR / 'apps/api/frameforge.db'}"
        )
        DATABASE_SYNC_URL: str = os.environ.get(
            "DATABASE_SYNC_URL",
            f"sqlite:///{BASE_DIR / 'apps/api/frameforge.db'}"
        )

        # Redis
        REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

        # Object Storage (S3 / MinIO)
        S3_ENDPOINT: str = "http://localhost:9000"
        S3_ACCESS_KEY: str = "minioadmin"
        S3_SECRET_KEY: str = "minioadmin"
        S3_BUCKET: str = "frameforge-media"
        S3_USE_SSL: bool = False

        # Seed Admin Credentials
        INITIAL_ADMIN_EMAIL: str = "admin@company.internal"
        INITIAL_ADMIN_PASSWORD: str = "FrameForge2026!Admin"
        INITIAL_ADMIN_NAME: str = "系统超级管理员"

    settings = Settings()

except ImportError:
    class Settings:
        API_HOST: str = os.environ.get("API_HOST", "0.0.0.0")
        API_PORT: int = int(os.environ.get("API_PORT", "8000"))
        API_V1_PREFIX: str = os.environ.get("API_V1_PREFIX", "/api/v1")
        ENVIRONMENT: str = os.environ.get("ENVIRONMENT", "development")
        LOG_LEVEL: str = os.environ.get("LOG_LEVEL", "info")
        SECRET_KEY: str = os.environ.get("SECRET_KEY", "frameforge-secret-key-production-ready-2026")
        ALGORITHM: str = "HS256"
        ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 14

        DATABASE_URL: str = os.environ.get(
            "DATABASE_URL",
            f"sqlite+aiosqlite:///{BASE_DIR / 'apps/api/frameforge.db'}"
        )
        DATABASE_SYNC_URL: str = os.environ.get(
            "DATABASE_SYNC_URL",
            f"sqlite:///{BASE_DIR / 'apps/api/frameforge.db'}"
        )

        REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        S3_ENDPOINT: str = os.environ.get("S3_ENDPOINT", "http://localhost:9000")
        S3_ACCESS_KEY: str = os.environ.get("S3_ACCESS_KEY", "minioadmin")
        S3_SECRET_KEY: str = os.environ.get("S3_SECRET_KEY", "minioadmin")
        S3_BUCKET: str = os.environ.get("S3_BUCKET", "frameforge-media")
        S3_USE_SSL: bool = False

        INITIAL_ADMIN_EMAIL: str = os.environ.get("INITIAL_ADMIN_EMAIL", "admin@company.internal")
        INITIAL_ADMIN_PASSWORD: str = os.environ.get("INITIAL_ADMIN_PASSWORD", "FrameForge2026!Admin")
        INITIAL_ADMIN_NAME: str = os.environ.get("INITIAL_ADMIN_NAME", "系统超级管理员")

    settings = Settings()
