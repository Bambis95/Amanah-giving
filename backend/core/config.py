import logging
import os
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # Application
    app_name: str = "FastAPI Modular Template"
    debug: bool = False
    version: str = "1.0.0"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    
    # JWT Authentication
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

        # Stripe / Payments
    stripe_secret_key: str = ""
    frontend_url: str = "http://localhost:5173"

     # PayDunya
    paydunya_mode: str = "test"
    paydunya_master_key: str = ""
    paydunya_private_key: str = ""
    paydunya_public_key: str = ""
    paydunya_token: str = ""
    paydunya_callback_url: str = "http://127.0.0.1:8000/api/v1/payment/paydunya/ipn"

    # Session cookie (httpOnly: the login token is never readable by JavaScript)
    session_cookie_name: str = "amanah_session"
    session_cookie_secure: bool = False  # set to true in production (HTTPS only)
    # Extra origins allowed by CORS, comma-separated; FRONTEND_URL is always allowed
    cors_origins: str = ""

    @property
    def allowed_origins(self) -> list:
        origins = [self.frontend_url] + [o for o in self.cors_origins.split(",") if o.strip()]
        return sorted({o.strip().rstrip("/") for o in origins if o.strip()})

    # Email (SMTP) for donation confirmations; sending is skipped while SMTP_HOST is empty
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_ssl: bool = False  # True for port 465 (implicit TLS); otherwise STARTTLS is used
    email_from: str = ""
    email_from_name: str = "Amanah Giving"

    # Database: PostgreSQL is the official database of this project
    # (security, transactions, backups). Set DATABASE_URL to connect to it:
    #   postgresql+asyncpg://user:password@host:5432/amanah_giving
    # The SQLite value below is only a zero-config fallback for quick local tests.
    database_url: str = "sqlite+aiosqlite:///./app.db"

    # AWS Lambda Configuration
    is_lambda: bool = False
    lambda_function_name: str = "fastapi-backend"
    aws_region: str = "us-east-1"

    @property
    def backend_url(self) -> str:
        """Generate backend URL from host and port."""
        if self.is_lambda:
            # In Lambda environment, return the API Gateway URL
            return os.environ.get(
                "PYTHON_BACKEND_URL", f"https://{self.lambda_function_name}.execute-api.{self.aws_region}.amazonaws.com"
            )
        else:
            # Use localhost for external callbacks instead of 0.0.0.0
            display_host = "127.0.0.1" if self.host == "0.0.0.0" else self.host
            return os.environ.get("PYTHON_BACKEND_URL", f"http://{display_host}:{self.port}")

    model_config = SettingsConfigDict(
        case_sensitive=False,
        extra="ignore",
        env_file=".env",
        env_file_encoding="utf-8",
    )

    def __getattr__(self, name: str) -> Any:
        """
        Dynamically read attributes from environment variables.
        For example: settings.opapi_key reads from OPAPI_KEY environment variable.

        Args:
            name: Attribute name (e.g., 'opapi_key')

        Returns:
            Value from environment variable

        Raises:
            AttributeError: If attribute doesn't exist and not found in environment variables
        """
        # Convert attribute name to environment variable name (snake_case -> UPPER_CASE)
        env_var_name = name.upper()

        # Check if environment variable exists
        if env_var_name in os.environ:
            value = os.environ[env_var_name]
            # Cache the value in instance dict to avoid repeated lookups
            self.__dict__[name] = value
            logger.debug(f"Read dynamic attribute {name} from environment variable {env_var_name}")
            return value

        # If not found, raise AttributeError to maintain normal Python behavior
        raise AttributeError(f"'{self.__class__.__name__}' object has no attribute '{name}'")


# Global settings instance
settings = Settings()
