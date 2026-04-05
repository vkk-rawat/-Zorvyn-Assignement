# Finance Data Processing and Access Control API

Production-structured FastAPI backend for user administration, JWT authentication, refresh-token rotation, role-based authorization, finance record processing, dashboard analytics, category master data, and audit logging.

## 1. Architecture Explanation

- Framework: FastAPI with layered route, service, schema, model, middleware, and utility modules.
- Persistence: SQLAlchemy ORM with SQLite as the default local database and PostgreSQL-ready configuration through `DATABASE_URL`.
- Security: access JWTs plus database-backed refresh token rotation, secure password hashing, active/inactive user enforcement, and dependency-based RBAC.
- Domain design: finance records reference a managed category master table, which keeps dashboard analytics and validation consistent.
- Observability: audit logging captures auth events and privileged data changes for admin review.
- Reliability: centralized exception handling, strict Pydantic validation, soft deletes for records, pagination/search/filtering, and login rate limiting.

## 2. Database Schema

### `users`

| Column          | Type        | Notes                        |
| --------------- | ----------- | ---------------------------- |
| `id`            | Integer     | Primary key                  |
| `name`          | String(100) | Required                     |
| `email`         | String(255) | Unique, indexed              |
| `password_hash` | String(255) | Secure password hash         |
| `role`          | Enum        | `viewer`, `analyst`, `admin` |
| `status`        | Enum        | `active`, `inactive`         |
| `created_at`    | DateTime    | UTC timestamp                |
| `updated_at`    | DateTime    | UTC timestamp                |

### `categories`

| Column        | Type       | Notes                                        |
| ------------- | ---------- | -------------------------------------------- |
| `id`          | Integer    | Primary key                                  |
| `name`        | String(80) | Indexed                                      |
| `record_type` | Enum       | `income`, `expense`                          |
| `description` | Text       | Optional                                     |
| `is_active`   | Boolean    | Allows deactivation without deleting history |
| `created_at`  | DateTime   | UTC timestamp                                |
| `updated_at`  | DateTime   | UTC timestamp                                |

### `financial_records`

| Column        | Type          | Notes                 |
| ------------- | ------------- | --------------------- |
| `id`          | Integer       | Primary key           |
| `amount`      | Numeric(12,2) | Positive amount       |
| `type`        | Enum          | `income`, `expense`   |
| `category_id` | Integer       | FK to `categories.id` |
| `date`        | Date          | Transaction date      |
| `notes`       | Text          | Optional              |
| `created_by`  | Integer       | FK to `users.id`      |
| `created_at`  | DateTime      | UTC timestamp         |
| `updated_at`  | DateTime      | UTC timestamp         |
| `deleted_at`  | DateTime      | Soft-delete marker    |

### `refresh_tokens`

| Column       | Type        | Notes                             |
| ------------ | ----------- | --------------------------------- |
| `id`         | Integer     | Primary key                       |
| `user_id`    | Integer     | FK to `users.id`                  |
| `token_hash` | String(128) | Stored hash of refresh token      |
| `expires_at` | DateTime    | Refresh expiry                    |
| `created_at` | DateTime    | UTC timestamp                     |
| `revoked_at` | DateTime    | Rotation/logout revocation marker |

### `audit_logs`

| Column          | Type        | Notes                              |
| --------------- | ----------- | ---------------------------------- |
| `id`            | Integer     | Primary key                        |
| `actor_user_id` | Integer     | FK to `users.id`, nullable         |
| `action`        | String(100) | Event name such as `record.create` |
| `entity_type`   | String(50)  | Target entity type                 |
| `entity_id`     | String(50)  | Target entity id                   |
| `status`        | String(20)  | `success` or `failure`             |
| `details_text`  | Text        | Serialized context payload         |
| `created_at`    | DateTime    | UTC timestamp                      |

## 3. Folder Structure

```text
app/
  main.py
  config.py
  database/
  middleware/
  models/
  routes/
  schemas/
  services/
  utils/
alembic/
docs/
tests/
Dockerfile
docker-compose.yml
requirements.txt
README.md
```

## 4. Full Code Files

All source files are included in this repository under `app/`, `tests/`, `alembic/`, and `docs/`.

## 5. API Endpoint Documentation

Detailed endpoint documentation lives in `docs/api.md`. Interactive Swagger documentation is available at `/docs` once the app is running.

## 6. Example Requests and Responses

Examples for login, refresh, logout, category management, record creation, dashboard summaries, and audit-log retrieval are included in `docs/api.md`.

## 7. Setup Instructions

1. Create a virtual environment.
2. Install dependencies: `python -m pip install -r requirements.txt`
3. Copy `.env.example` to `.env`
4. Set a strong `JWT_SECRET_KEY`
5. Optionally enable bootstrap admin credentials in `.env`
6. Start the API: `uvicorn app.main:app --reload`

For PostgreSQL with Docker:

1. Set `DATABASE_URL=postgresql+psycopg://finance_user:finance_password@db:5432/finance_db` in `.env`
2. Run `docker compose up --build`

## 8. Testing Instructions

1. Install dependencies
2. Run `python -m pytest -q`
3. Tests use an isolated in-memory SQLite database

## 9. Frontend Demo

The repository now includes a single-file React frontend built with Vite, Tailwind CSS, and Recharts.

1. Install frontend dependencies: `npm install`
2. Start the frontend: `npm run dev`
3. The app proxies `/api` requests to the backend on `http://127.0.0.1:8000`

Entry points:

- `index.html` loads `src/main.jsx`
- `src/main.jsx` renders `src/App.jsx`
- `src/App.jsx` mounts [FinanceDashboard.jsx](FinanceDashboard.jsx)

For the full local demo, run the backend and frontend together, then sign in using the role selector on the login screen.
