from __future__ import annotations

import json
from math import ceil
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.schemas.audit_schema import AuditLogResponse
from app.schemas.common import PaginationMeta


def log_action(
    db: Session,
    *,
    action: str,
    entity_type: str,
    status: str = "success",
    actor_user_id: Optional[int] = None,
    entity_id: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
) -> Optional[AuditLog]:
    audit_log = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        status=status,
        details_text=json.dumps(details, default=str) if details is not None else None,
    )

    try:
        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)
        return audit_log
    except Exception:
        db.rollback()
        return None


def _to_response(audit_log: AuditLog) -> AuditLogResponse:
    details = json.loads(audit_log.details_text) if audit_log.details_text else None
    return AuditLogResponse(
        id=audit_log.id,
        actor_user_id=audit_log.actor_user_id,
        action=audit_log.action,
        entity_type=audit_log.entity_type,
        entity_id=audit_log.entity_id,
        status=audit_log.status,
        details=details,
        created_at=audit_log.created_at,
    )


def list_audit_logs(
    db: Session,
    *,
    page: int,
    page_size: int,
    actor_user_id: Optional[int] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    status: Optional[str] = None,
) -> tuple[list[AuditLogResponse], PaginationMeta]:
    conditions = []
    if actor_user_id is not None:
        conditions.append(AuditLog.actor_user_id == actor_user_id)
    if action:
        conditions.append(AuditLog.action == action.strip())
    if entity_type:
        conditions.append(AuditLog.entity_type == entity_type.strip())
    if status:
        conditions.append(AuditLog.status == status.strip())

    total_items = db.scalar(select(func.count(AuditLog.id)).where(*conditions)) or 0
    items = db.scalars(
        select(AuditLog)
        .where(*conditions)
        .order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    pagination = PaginationMeta(
        page=page,
        page_size=page_size,
        total_items=total_items,
        total_pages=max(1, ceil(total_items / page_size)) if page_size else 1,
    )
    return [_to_response(item) for item in items], pagination
