from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.middleware.role_guard import require_roles
from app.models.user import User, UserRole
from app.schemas.audit_schema import AuditLogListResponse
from app.services.audit_service import list_audit_logs


router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])
admin_guard = require_roles(UserRole.admin)


@router.get("", response_model=AuditLogListResponse, summary="List audit logs")
def list_audit_logs_endpoint(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(admin_guard)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    actor_user_id: Optional[int] = Query(default=None, ge=1),
    action: Optional[str] = Query(default=None, min_length=2, max_length=100),
    entity_type: Optional[str] = Query(default=None, min_length=2, max_length=50),
    status: Optional[str] = Query(default=None, min_length=2, max_length=20),
) -> AuditLogListResponse:
    del current_user
    items, pagination = list_audit_logs(
        db,
        page=page,
        page_size=page_size,
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        status=status,
    )
    return AuditLogListResponse(items=items, pagination=pagination)
