from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database.connection import SessionLocal, init_db
from app.middleware.rate_limit import InMemoryRateLimiter
from app.routes import (
    audit_routes,
    auth_routes,
    category_routes,
    dashboard_routes,
    record_routes,
    user_routes,
)
from app.services.user_service import ensure_bootstrap_admin
from app.utils.exceptions import register_exception_handlers


settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.auto_create_tables:
        init_db()

    with SessionLocal() as db:
        ensure_bootstrap_admin(db)

    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Backend system for finance data processing, role-based access control, "
        "financial record CRUD, and dashboard analytics."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(
    InMemoryRateLimiter,
    max_requests=settings.login_rate_limit_requests,
    window_seconds=settings.login_rate_limit_window_seconds,
    protected_paths={f"{settings.api_prefix}/auth/login"},
)

register_exception_handlers(app)

app.include_router(auth_routes.router, prefix=settings.api_prefix)
app.include_router(user_routes.router, prefix=settings.api_prefix)
app.include_router(category_routes.router, prefix=settings.api_prefix)
app.include_router(record_routes.router, prefix=settings.api_prefix)
app.include_router(dashboard_routes.router, prefix=settings.api_prefix)
app.include_router(audit_routes.router, prefix=settings.api_prefix)


@app.get("/", tags=["System"])
def root() -> dict[str, str]:
    return {
        "message": settings.app_name,
        "docs_url": "/docs",
        "health_url": "/health",
    }


@app.get("/health", tags=["System"])
def health_check() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}
