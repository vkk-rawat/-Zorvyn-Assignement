from decimal import Decimal

from pydantic import BaseModel

from app.schemas.record_schema import RecordResponse


class SummaryResponse(BaseModel):
    total_income: Decimal
    total_expenses: Decimal
    net_balance: Decimal


class CategoryTotal(BaseModel):
    category: str
    income: Decimal
    expense: Decimal
    net: Decimal


class CategoryTotalsResponse(BaseModel):
    items: list[CategoryTotal]


class RecentTransactionsResponse(BaseModel):
    items: list[RecordResponse]


class MonthlyTrendItem(BaseModel):
    month: str
    income: Decimal
    expense: Decimal
    net: Decimal


class MonthlyTrendsResponse(BaseModel):
    items: list[MonthlyTrendItem]
