from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.category import Category
from app.models.financial_record import FinancialRecord, RecordType
from app.schemas.dashboard_schema import CategoryTotal, MonthlyTrendItem, SummaryResponse
from app.utils.validators import ensure_valid_date_range


def _base_conditions(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    ensure_valid_date_range(start_date, end_date)

    conditions = [FinancialRecord.deleted_at.is_(None)]
    if start_date:
        conditions.append(FinancialRecord.date >= start_date)
    if end_date:
        conditions.append(FinancialRecord.date <= end_date)
    return conditions


def get_summary(
    db: Session,
    *,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> SummaryResponse:
    conditions = _base_conditions(start_date, end_date)

    totals = db.execute(
        select(
            func.coalesce(
                func.sum(case((FinancialRecord.type == RecordType.income, FinancialRecord.amount), else_=0)),
                0,
            ).label("income"),
            func.coalesce(
                func.sum(case((FinancialRecord.type == RecordType.expense, FinancialRecord.amount), else_=0)),
                0,
            ).label("expense"),
        ).where(*conditions)
    ).one()

    total_income = Decimal(totals.income)
    total_expenses = Decimal(totals.expense)

    return SummaryResponse(
        total_income=total_income,
        total_expenses=total_expenses,
        net_balance=total_income - total_expenses,
    )


def get_category_totals(
    db: Session,
    *,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> list[CategoryTotal]:
    conditions = _base_conditions(start_date, end_date)
    rows = db.execute(
        select(
            Category.name.label("category"),
            FinancialRecord.type,
            func.coalesce(func.sum(FinancialRecord.amount), 0).label("total"),
        )
        .select_from(FinancialRecord)
        .join(Category)
        .where(*conditions)
        .group_by(Category.name, FinancialRecord.type)
        .order_by(Category.name.asc())
    ).all()

    grouped: dict[str, dict[str, Decimal]] = {}
    for row in rows:
        category = row.category
        grouped.setdefault(
            category,
            {"income": Decimal("0.00"), "expense": Decimal("0.00")},
        )
        grouped[category][row.type.value] = Decimal(row.total)

    return [
        CategoryTotal(
            category=category,
            income=values["income"],
            expense=values["expense"],
            net=values["income"] - values["expense"],
        )
        for category, values in grouped.items()
    ]


def get_recent_transactions(
    db: Session,
    *,
    limit: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    conditions = _base_conditions(start_date, end_date)
    return db.scalars(
        select(FinancialRecord)
        .options(selectinload(FinancialRecord.category))
        .where(*conditions)
        .order_by(FinancialRecord.date.desc(), FinancialRecord.created_at.desc())
        .limit(limit)
    ).all()


def get_monthly_trends(
    db: Session,
    *,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> list[MonthlyTrendItem]:
    conditions = _base_conditions(start_date, end_date)

    if db.bind and db.bind.dialect.name == "sqlite":
        month_expression = func.strftime("%Y-%m", FinancialRecord.date)
    else:
        month_expression = func.to_char(FinancialRecord.date, "YYYY-MM")

    rows = db.execute(
        select(
            month_expression.label("month"),
            FinancialRecord.type,
            func.coalesce(func.sum(FinancialRecord.amount), 0).label("total"),
        )
        .where(*conditions)
        .group_by("month", FinancialRecord.type)
        .order_by("month")
    ).all()

    grouped: dict[str, dict[str, Decimal]] = {}
    for row in rows:
        month = row.month
        grouped.setdefault(month, {"income": Decimal("0.00"), "expense": Decimal("0.00")})
        grouped[month][row.type.value] = Decimal(row.total)

    return [
        MonthlyTrendItem(
            month=month,
            income=values["income"],
            expense=values["expense"],
            net=values["income"] - values["expense"],
        )
        for month, values in grouped.items()
    ]
