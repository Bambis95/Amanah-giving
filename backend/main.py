import logging
import os
import traceback
from contextlib import asynccontextmanager
from datetime import datetime

from core.config import settings
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# MODULE_IMPORTS_START
from services.database import initialize_database, close_database
from services.mock_data import initialize_mock_data
from services.auth import initialize_admin_user
# MODULE_IMPORTS_END


def setup_logging():
    """Configure the logging system."""
    if os.environ.get("IS_LAMBDA") == "true":
        return

    # Create the logs directory
    log_dir = "logs"
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    # Generate log filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = f"{log_dir}/app_{timestamp}.log"

    # Configure log format
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    # DEBUG locally; set LOG_LEVEL=INFO in production (debug logs contain donor details)
    level = os.environ.get("LOG_LEVEL", "DEBUG").upper()

    # Configure the root logger
    logging.basicConfig(
        level=level,
        format=log_format,
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )

    # Set log levels for specific modules
    logging.getLogger("uvicorn").setLevel(level)
    logging.getLogger("fastapi").setLevel(level)
    logging.getLogger("watchfiles").setLevel(logging.WARNING)

    # Log configuration details
    logger = logging.getLogger(__name__)
    logger.info("=== Logging system initialized ===")
    logger.info(f"Log file: {log_file}")
    logger.info(f"Log level: {level}")
    logger.info(f"Timestamp: {timestamp}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger = logging.getLogger(__name__)
    logger.info("=== Application startup initiated ===")

    # MODULE_STARTUP_START
    await initialize_database()
    await initialize_mock_data()
    await initialize_admin_user()
    # MODULE_STARTUP_END

    logger.info("=== Application startup completed successfully ===")
    yield

    # MODULE_SHUTDOWN_START
    await close_database()
    # MODULE_SHUTDOWN_END


app = FastAPI(
    title="FastAPI Modular Template",
    description="A best-practice FastAPI template with modular architecture",
    version="1.0.0",
    lifespan=lifespan,
)


# ============================================================
# MIDDLEWARE
# ============================================================

# MODULE_MIDDLEWARE_START
app.add_middleware(
    CORSMiddleware,
    # With cookie sessions, allowing every origin would let any website act as a logged-in
    # visitor. Only our frontend (FRONTEND_URL, plus CORS_ORIGINS) may send credentials.
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
# MODULE_MIDDLEWARE_END


# ============================================================
# ROUTER IMPORTS
# ============================================================

from routers.aihub import router as aihub_router
from routers.auth import router as auth_router
from routers.contact_messages import router as contact_messages_router
from routers.donations import router as donations_router
from routers.health import router as health_router
from routers.payment_checkout import router as payment_checkout_router
from routers.projects import router as projects_router
from routers.settings import router as settings_router
from routers.stats import router as stats_router
from routers.audit import router as audit_router
from routers.site import router as site_router
from routers.mobile_deposits import router as mobile_deposits_router
from routers.storage import router as storage_router
from routers.user import router as user_router
from routers.invitations import router as invitations_router
from routers.images import router as images_router
from routers.finance import public_router as transparency_router, router as finance_router
from routers.project_updates import router as project_updates_router
from routers.share import router as share_router


# ============================================================
# ROUTER REGISTRATION
# ============================================================

app.include_router(auth_router)
app.include_router(settings_router)
app.include_router(donations_router)
app.include_router(projects_router)
app.include_router(payment_checkout_router)
app.include_router(storage_router)
app.include_router(user_router)
app.include_router(aihub_router)
app.include_router(contact_messages_router)
app.include_router(health_router)
app.include_router(stats_router)
app.include_router(audit_router)
app.include_router(site_router)
app.include_router(mobile_deposits_router)
app.include_router(invitations_router)
app.include_router(images_router)
app.include_router(finance_router)
app.include_router(transparency_router)
app.include_router(project_updates_router)
app.include_router(share_router)


# ============================================================
# LOGGING
# ============================================================

setup_logging()

logger = logging.getLogger(__name__)

logger.info("=== Router registration completed ===")
logger.info("Registered routers:")
logger.info("  - /api/v1/auth")
logger.info("  - /api/v1/admin/settings")
logger.info("  - /api/v1/entities/donations")
logger.info("  - /api/v1/entities/projects")
logger.info("  - /api/v1/payment")
logger.info("  - /api/v1/storage")
logger.info("  - /api/v1/users")
logger.info("  - /api/v1/aihub")
logger.info("  - /api/v1/entities/contact_messages")
logger.info("  - /database")


# ============================================================
# EXCEPTION HANDLER
# ============================================================

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all exceptions except HTTPException.

    Dev environment:
        Return full stack trace and exception details.

    Production environment:
        Return only a generic error message.
    """

    # Re-raise HTTPException to let FastAPI handle it normally
    if isinstance(exc, HTTPException):
        raise exc

    logger = logging.getLogger(__name__)

    error_message = str(exc)
    error_type = type(exc).__name__

    # Log full error details regardless of environment
    logger.error(
        f"Exception: {error_type}: {error_message}\n"
        f"{traceback.format_exc()}"
    )

    # Determine if we're in dev environment
    is_dev = os.getenv("ENVIRONMENT", "prod").lower() == "dev"

    if is_dev:
        error_detail = (
            f"{error_type}: {error_message}\n"
            f"{traceback.format_exc()}"
        )

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": error_detail},
        )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal Server Error"},
    )


# ============================================================
# BASIC ROUTES
# ============================================================

@app.get("/")
def root():
    return {"message": "FastAPI Modular Template is running"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


# ============================================================
# DEBUG MODE
# ============================================================

def run_in_debug_mode(app: FastAPI):
    """Run the FastAPI app in debug mode with proper asyncio handling."""

    import asyncio
    from pathlib import Path

    import uvicorn
    from dotenv import load_dotenv

    # Load environment variables from ../.env in debug mode
    env_path = Path(__file__).parent.parent / ".env"

    if env_path.exists():
        load_dotenv(env_path, override=True)

        logger = logging.getLogger(__name__)
        logger.info(
            f"Loaded environment variables from {env_path}"
        )

    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=int(settings.port),
        log_level="info",
    )

    server = uvicorn.Server(config)

    asyncio.run(server.serve())


# ============================================================
# APPLICATION ENTRY POINT
# ============================================================

if __name__ == "__main__":
    import sys

    import uvicorn

    # Detect if running in debugger
    is_debugging = (
        "pydevd" in sys.modules
        or (
            hasattr(sys, "gettrace")
            and sys.gettrace() is not None
        )
    )

    if is_debugging:
        run_in_debug_mode(app)

    else:
        # Load environment variables from backend/.env
        from dotenv import load_dotenv

        env_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            ".env",
        )

        if os.path.exists(env_path):
            load_dotenv(env_path, override=True)
            print(
                f"Loaded environment variables from {env_path}"
            )

        # Start the server
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=int(settings.port),
            reload_excludes=["**/*.py"],
        )
