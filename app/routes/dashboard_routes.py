from __future__ import annotations

from datetime import date
from typing import Annotated
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.middleware.role_guard import require_roles
from app.models.user import User, UserRole
from app.schemas.dashboard_schema import (
    CategoryTotalsResponse,
    MonthlyTrendsResponse,
    RecentTransactionsResponse,
    SummaryResponse,
)
from app.schemas.record_schema import RecordResponse
from app.services.dashboard_service import (
    get_category_totals,
    get_monthly_trends,
    get_recent_transactions,
    get_summary,
)


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
summary_guard = require_roles(UserRole.viewer, UserRole.analyst, UserRole.admin)


@router.get("/summary", response_model=SummaryResponse, summary="Get summary totals")
def get_summary_endpoint(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(summary_guard)],
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
) -> SummaryResponse:
    del current_user
    return get_summary(db, start_date=start_date, end_date=end_date)


@router.get("/category-totals", response_model=CategoryTotalsResponse, summary="Get category totals")
def get_category_totals_endpoint(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(summary_guard)],
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
) -> CategoryTotalsResponse:
    del current_user
    return CategoryTotalsResponse(items=get_category_totals(db, start_date=start_date, end_date=end_date))


@router.get(
    "/recent-transactions",
    response_model=RecentTransactionsResponse,
    summary="Get recent transactions",
)
def get_recent_transactions_endpoint(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(summary_guard)],
    limit: int = Query(default=5, ge=1, le=50),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
) -> RecentTransactionsResponse:
    del current_user
    records = get_recent_transactions(
        db,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
    )
    return RecentTransactionsResponse(items=[RecordResponse.model_validate(record) for record in records])


@router.get("/monthly-trends", response_model=MonthlyTrendsResponse, summary="Get monthly trends")
def get_monthly_trends_endpoint(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(summary_guard)],
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
) -> MonthlyTrendsResponse:
    del current_user
    return MonthlyTrendsResponse(items=get_monthly_trends(db, start_date=start_date, end_date=end_date))
