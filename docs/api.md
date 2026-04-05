# API Documentation

Base URL: `/api/v1`

## Authentication

### `POST /auth/login`

Request:

```json
{
  "email": "admin@example.com",
  "password": "ChangeMe123!"
}
```

Response:

```json
{
  "access_token": "<jwt>",
  "refresh_token": "<opaque-refresh-token>",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_expires_in": 604800,
  "user": {
    "id": 1,
    "name": "Finance Admin",
    "email": "admin@example.com",
    "role": "admin",
    "status": "active"
  }
}
```

### `POST /auth/refresh`

Request:

```json
{
  "refresh_token": "<opaque-refresh-token>"
}
```

Returns a fresh access token plus a rotated refresh token.

### `POST /auth/logout`

Request:

```json
{
  "refresh_token": "<opaque-refresh-token>"
}
```

Revokes the refresh token.

## Users

Admin only.

### `POST /users`

Request:

```json
{
  "name": "Data Analyst",
  "email": "analyst@example.com",
  "password": "Analyst123!",
  "role": "analyst",
  "status": "active"
}
```

### `PATCH /users/{user_id}`

Request:

```json
{
  "role": "viewer",
  "status": "inactive"
}
```

### `POST /users/{user_id}/deactivate`

Marks the target user as inactive.

## Categories

Viewer, Analyst, and Admin can list categories. Admin manages them.

### `POST /categories`

Request:

```json
{
  "name": "Salary",
  "record_type": "income",
  "description": "Payroll and compensation",
  "is_active": true
}
```

### `GET /categories`

Supported query params:

- `page`
- `page_size`
- `record_type`
- `is_active`
- `search`

## Financial Records

Analyst and Admin can read. Admin can create, update, and delete.

### `POST /records`

Request:

```json
{
  "amount": "2500.00",
  "type": "income",
  "category_id": 1,
  "date": "2026-03-01",
  "notes": "Monthly payroll"
}
```

### `GET /records`

Supported query params:

- `page`
- `page_size`
- `start_date`
- `end_date`
- `category`
- `category_id`
- `type`
- `search`

Response:

```json
{
  "items": [
    {
      "id": 1,
      "amount": "2500.00",
      "type": "income",
      "category_id": 1,
      "category_name": "Salary",
      "category": {
        "id": 1,
        "name": "Salary",
        "record_type": "income",
        "description": "Payroll and compensation",
        "is_active": true,
        "created_at": "2026-03-01T10:00:00Z",
        "updated_at": "2026-03-01T10:00:00Z"
      },
      "date": "2026-03-01",
      "notes": "Monthly payroll",
      "created_by": 1,
      "created_at": "2026-03-01T10:00:00Z",
      "updated_at": "2026-03-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_items": 1,
    "total_pages": 1
  }
}
```

## Dashboard

Viewer, Analyst, and Admin can access these endpoints.

### `GET /dashboard/summary`

Response:

```json
{
  "total_income": "7000.00",
  "total_expenses": "1500.00",
  "net_balance": "5500.00"
}
```

### `GET /dashboard/category-totals`

Returns category totals with `income`, `expense`, and `net`.

### `GET /dashboard/recent-transactions`

Supported query params:

- `limit`
- `start_date`
- `end_date`

### `GET /dashboard/monthly-trends`

Response:

```json
{
  "items": [
    {
      "month": "2026-01",
      "income": "5000.00",
      "expense": "1200.00",
      "net": "3800.00"
    },
    {
      "month": "2026-02",
      "income": "2000.00",
      "expense": "300.00",
      "net": "1700.00"
    }
  ]
}
```

## Audit Logs

Admin only.

### `GET /audit-logs`

Supported query params:

- `page`
- `page_size`
- `actor_user_id`
- `action`
- `entity_type`
- `status`

Use this endpoint to inspect auth events and privileged data changes such as user, category, and record operations.

## Role Matrix

- `viewer`: dashboard + category lookup
- `analyst`: dashboard + category lookup + read-only record access
- `admin`: full access to users, categories, records, dashboard, and audit logs
