import React, { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const DEFAULT_PAGE_SIZE = 10;
const NAV_ITEMS = [
  {
    key: "dashboard",
    label: "Dashboard",
    roles: ["viewer", "analyst", "admin"],
  },
  {
    key: "transactions",
    label: "Transactions",
    roles: ["viewer", "analyst", "admin"],
  },
  { key: "users", label: "Users", roles: ["admin"] },
];

const ROLE_OPTIONS = [
  { value: "viewer", label: "Viewer" },
  { value: "analyst", label: "Analyst" },
  { value: "admin", label: "Admin" },
];

const DEMO_ACCOUNTS = {
  viewer: {
    email: "viewer@example.com",
    password: "Viewer123!",
    name: "Viewer User",
  },
  analyst: {
    email: "analyst@example.com",
    password: "Analyst123!",
    name: "Analyst User",
  },
  admin: {
    email: "admin@example.com",
    password: "Admin123!",
    name: "Admin User",
  },
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

function prettyRole(role) {
  return capitalize(role || "viewer");
}

function isBrowser() {
  return typeof window !== "undefined";
}

function readStoredSession() {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem("finance-dashboard-session");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStoredSession(session) {
  if (!isBrowser()) {
    return;
  }

  try {
    if (session) {
      window.localStorage.setItem(
        "finance-dashboard-session",
        JSON.stringify(session),
      );
    } else {
      window.localStorage.removeItem("finance-dashboard-session");
    }
  } catch {
    // Ignore localStorage errors in restrictive environments.
  }
}

function parseAmount(value) {
  const numberValue =
    typeof value === "number" ? value : Number.parseFloat(String(value || 0));
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseAmount(value));
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatMonth(value) {
  if (!value) {
    return "-";
  }

  const [year, month] = String(value).split("-");
  if (!year || !month) {
    return String(value);
  }

  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeTransaction(record) {
  const category = record.category || {};
  return {
    id: record.id,
    amount: parseAmount(record.amount),
    type: record.type,
    categoryId: record.categoryId ?? record.category_id ?? category.id ?? null,
    categoryName:
      record.categoryName ??
      record.category_name ??
      category.name ??
      record.category ??
      "Uncategorized",
    categoryType:
      category.record_type ??
      category.recordType ??
      record.categoryType ??
      record.type,
    date: record.date,
    notes: record.notes || "",
    createdBy: record.createdBy ?? record.created_by ?? null,
    updatedAt: record.updatedAt ?? record.updated_at ?? null,
  };
}

function normalizeCategory(category) {
  return {
    id: category.id,
    name: category.name,
    recordType: category.recordType ?? category.record_type ?? "expense",
    description: category.description || "",
    isActive: category.isActive ?? category.is_active ?? true,
  };
}

function normalizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

function normalizeSummary(summary) {
  if (!summary) {
    return { totalIncome: 0, totalExpenses: 0, netBalance: 0 };
  }

  const totalIncome =
    summary.total_income ?? summary.totalIncome ?? summary.income ?? 0;
  const totalExpenses =
    summary.total_expenses ?? summary.totalExpenses ?? summary.expense ?? 0;
  const netBalance =
    summary.net_balance ??
    summary.netBalance ??
    summary.net ??
    parseAmount(totalIncome) - parseAmount(totalExpenses);

  return {
    totalIncome: parseAmount(totalIncome),
    totalExpenses: parseAmount(totalExpenses),
    netBalance: parseAmount(netBalance),
  };
}

function normalizeMonthlyTrends(payload) {
  const items = Array.isArray(payload) ? payload : payload?.items || [];
  return items.map((item) => ({
    month: item.month,
    income: parseAmount(item.income ?? item.total_income ?? 0),
    expense: parseAmount(item.expense ?? item.total_expenses ?? 0),
    net: parseAmount(
      item.net ??
        item.net_balance ??
        parseAmount(item.income ?? 0) - parseAmount(item.expense ?? 0),
    ),
  }));
}

function normalizeCategoryList(payload) {
  const items = Array.isArray(payload) ? payload : payload?.items || [];
  return items.map(normalizeCategory);
}

function normalizeUserList(payload) {
  const items = Array.isArray(payload) ? payload : payload?.items || [];
  return items.map(normalizeUser);
}

function normalizeTransactionList(payload) {
  const items = Array.isArray(payload)
    ? payload
    : payload?.items || payload?.records || [];
  return items.map(normalizeTransaction);
}

function extractPagination(
  payload,
  fallbackPage,
  fallbackPageSize,
  fallbackTotalItems,
) {
  const pagination = payload?.pagination || {};
  const page = pagination.page ?? fallbackPage;
  const pageSize =
    pagination.page_size ?? pagination.pageSize ?? fallbackPageSize;
  const totalItems =
    pagination.total_items ?? pagination.totalItems ?? fallbackTotalItems;
  const totalPages =
    pagination.total_pages ??
    pagination.totalPages ??
    Math.max(1, Math.ceil((totalItems || 0) / (pageSize || 1)));

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
  };
}

function buildQuery(params) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      value !== "all"
    ) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildHeaders(token, body) {
  const headers = {
    Accept: "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

async function readResponseError(response) {
  try {
    const payload = await response.json();
    return (
      payload?.detail ||
      payload?.message ||
      response.statusText ||
      `Request failed with status ${response.status}`
    );
  } catch {
    try {
      const text = await response.text();
      return (
        text ||
        response.statusText ||
        `Request failed with status ${response.status}`
      );
    } catch {
      return (
        response.statusText || `Request failed with status ${response.status}`
      );
    }
  }
}

async function fetchJson(path, token, init = {}) {
  const response = await fetch(path, {
    ...init,
    headers: buildHeaders(token, init.body),
  });

  if (response.status === 204) {
    return null;
  }

  if (response.status === 401 || response.status === 403) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    error.detail = await readResponseError(response);
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    error.detail = await readResponseError(response);
    throw error;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function fetchFirstJson(paths, token, init = {}) {
  let lastError = null;

  for (const path of paths) {
    try {
      return await fetchJson(path, token, init);
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        throw error;
      }

      lastError = error;
    }
  }

  throw lastError || new Error("Backend unavailable");
}

function shouldUseMockFallback(error) {
  return !error?.status || error.status === 404;
}

function deriveSummary(transactions) {
  const totalIncome = transactions.reduce(
    (sum, entry) =>
      sum + (entry.type === "income" ? parseAmount(entry.amount) : 0),
    0,
  );
  const totalExpenses = transactions.reduce(
    (sum, entry) =>
      sum + (entry.type === "expense" ? parseAmount(entry.amount) : 0),
    0,
  );

  return {
    totalIncome,
    totalExpenses,
    netBalance: totalIncome - totalExpenses,
  };
}

function deriveMonthlyTrends(transactions) {
  const grouped = new Map();

  transactions.forEach((entry) => {
    const monthKey = String(entry.date || "").slice(0, 7);
    if (!monthKey) {
      return;
    }

    if (!grouped.has(monthKey)) {
      grouped.set(monthKey, { month: monthKey, income: 0, expense: 0 });
    }

    const bucket = grouped.get(monthKey);
    if (entry.type === "income") {
      bucket.income += parseAmount(entry.amount);
    } else if (entry.type === "expense") {
      bucket.expense += parseAmount(entry.amount);
    }
  });

  return Array.from(grouped.values())
    .sort((left, right) => left.month.localeCompare(right.month))
    .map((bucket) => ({
      month: bucket.month,
      income: bucket.income,
      expense: bucket.expense,
      net: bucket.income - bucket.expense,
    }));
}

function paginateTransactions(transactions, page, pageSize) {
  const totalItems = transactions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const items = transactions.slice(startIndex, startIndex + pageSize);

  return {
    items,
    pagination: {
      page: safePage,
      pageSize,
      totalItems,
      totalPages,
    },
  };
}

function filterTransactions(transactions, filters) {
  const { startDate, endDate, category, type } = filters;
  return transactions.filter((entry) => {
    if (startDate && String(entry.date) < startDate) {
      return false;
    }

    if (endDate && String(entry.date) > endDate) {
      return false;
    }

    if (category && category !== "all" && entry.categoryName !== category) {
      return false;
    }

    if (type && type !== "all" && entry.type !== type) {
      return false;
    }

    return true;
  });
}

function createMockStore() {
  const categories = [
    {
      id: 1,
      name: "Salary",
      recordType: "income",
      description: "Monthly payroll",
      isActive: true,
    },
    {
      id: 2,
      name: "Consulting",
      recordType: "income",
      description: "Client projects",
      isActive: true,
    },
    {
      id: 3,
      name: "Rent",
      recordType: "expense",
      description: "Office lease",
      isActive: true,
    },
    {
      id: 4,
      name: "Travel",
      recordType: "expense",
      description: "Transport and trips",
      isActive: true,
    },
    {
      id: 5,
      name: "Software",
      recordType: "expense",
      description: "Tools and subscriptions",
      isActive: true,
    },
  ];

  const transactions = [
    {
      id: 1,
      amount: 5000,
      type: "income",
      categoryId: 1,
      categoryName: "Salary",
      date: "2026-01-05",
      notes: "Primary salary",
    },
    {
      id: 2,
      amount: 1250,
      type: "expense",
      categoryId: 3,
      categoryName: "Rent",
      date: "2026-01-07",
      notes: "Office rent",
    },
    {
      id: 3,
      amount: 2100,
      type: "income",
      categoryId: 2,
      categoryName: "Consulting",
      date: "2026-01-18",
      notes: "Project milestone",
    },
    {
      id: 4,
      amount: 320,
      type: "expense",
      categoryId: 5,
      categoryName: "Software",
      date: "2026-01-20",
      notes: "Design tools",
    },
    {
      id: 5,
      amount: 5200,
      type: "income",
      categoryId: 1,
      categoryName: "Salary",
      date: "2026-02-05",
      notes: "Monthly salary",
    },
    {
      id: 6,
      amount: 200,
      type: "expense",
      categoryId: 4,
      categoryName: "Travel",
      date: "2026-02-08",
      notes: "Airport transfer",
    },
    {
      id: 7,
      amount: 1650,
      type: "expense",
      categoryId: 3,
      categoryName: "Rent",
      date: "2026-02-12",
      notes: "Shared workspace",
    },
    {
      id: 8,
      amount: 2400,
      type: "income",
      categoryId: 2,
      categoryName: "Consulting",
      date: "2026-02-25",
      notes: "Retainer fee",
    },
    {
      id: 9,
      amount: 5300,
      type: "income",
      categoryId: 1,
      categoryName: "Salary",
      date: "2026-03-05",
      notes: "Payroll deposit",
    },
    {
      id: 10,
      amount: 410,
      type: "expense",
      categoryId: 5,
      categoryName: "Software",
      date: "2026-03-09",
      notes: "Hosting renewals",
    },
    {
      id: 11,
      amount: 280,
      type: "expense",
      categoryId: 4,
      categoryName: "Travel",
      date: "2026-03-17",
      notes: "Client visit",
    },
    {
      id: 12,
      amount: 2600,
      type: "income",
      categoryId: 2,
      categoryName: "Consulting",
      date: "2026-03-22",
      notes: "Implementation work",
    },
    {
      id: 13,
      amount: 5400,
      type: "income",
      categoryId: 1,
      categoryName: "Salary",
      date: "2026-04-05",
      notes: "Monthly salary",
    },
    {
      id: 14,
      amount: 1550,
      type: "expense",
      categoryId: 3,
      categoryName: "Rent",
      date: "2026-04-07",
      notes: "Office rent",
    },
    {
      id: 15,
      amount: 390,
      type: "expense",
      categoryId: 5,
      categoryName: "Software",
      date: "2026-04-11",
      notes: "Productivity apps",
    },
    {
      id: 16,
      amount: 2500,
      type: "income",
      categoryId: 2,
      categoryName: "Consulting",
      date: "2026-04-20",
      notes: "Strategy consulting",
    },
  ];

  const users = [
    {
      id: 1,
      name: "Admin User",
      email: "admin@example.com",
      role: "admin",
      status: "active",
    },
    {
      id: 2,
      name: "Analyst User",
      email: "analyst@example.com",
      role: "analyst",
      status: "active",
    },
    {
      id: 3,
      name: "Viewer User",
      email: "viewer@example.com",
      role: "viewer",
      status: "active",
    },
    {
      id: 4,
      name: "Inactive Analyst",
      email: "inactive.analyst@example.com",
      role: "analyst",
      status: "inactive",
    },
  ];

  const summary = deriveSummary(transactions);
  const monthlyTrends = deriveMonthlyTrends(transactions);

  return {
    categories,
    transactions,
    users,
    summary,
    monthlyTrends,
  };
}

const MOCK_STORE = createMockStore();

function ErrorBanner({ message, onRetry }) {
  if (!message) {
    return null;
  }

  return (
    <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>{message}</span>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}

function LoadingBlock({ message }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="text-sm font-medium text-slate-500">{message}</div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
        {label}
      </div>
      <div className={`mt-3 text-3xl font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    green: "bg-emerald-100 text-emerald-700 border-emerald-200",
    amber: "bg-amber-100 text-amber-700 border-amber-200",
    rose: "bg-rose-100 text-rose-700 border-rose-200",
    blue: "bg-sky-100 text-sky-700 border-sky-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone] || tones.slate}`}
    >
      {children}
    </span>
  );
}

function LoginPage({ form, setForm, error, onSubmit, loading }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.12),_transparent_24%),linear-gradient(135deg,_#f8fafc_0%,_#eef2f7_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2rem] border border-slate-200/70 bg-slate-950 px-8 py-10 text-slate-100 shadow-2xl shadow-slate-900/20">
          <div className="inline-flex rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">
            Finance Dashboard
          </div>
          <h1 className="mt-6 max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">
            Role-aware finance operations with a clean dashboard workflow.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
            Sign in with a demo role to explore the dashboard, transactions, and
            admin-only user management. If the backend is offline, the interface
            falls back to static data so the app remains fully demonstrable.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                Viewer
              </div>
              <div className="mt-2 text-sm text-slate-200">
                Dashboard and read-only insights.
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                Analyst
              </div>
              <div className="mt-2 text-sm text-slate-200">
                Records, trends, and summaries.
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                Admin
              </div>
              <div className="mt-2 text-sm text-slate-200">
                Full management access.
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_30px_80px_rgba(15,23,42,0.12)]">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
            Login
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            Access the finance workspace
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Use the role selector to auto-fill demo credentials during testing.
          </p>

          {error ? <ErrorBanner message={error} /> : null}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Role selector
              </label>
              <select
                value={form.role}
                onChange={(event) => {
                  const role = event.target.value;
                  const demo = DEMO_ACCOUNTS[role] || DEMO_ACCOUNTS.viewer;
                  setForm({ role, email: demo.email, password: demo.password });
                }}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                placeholder="name@example.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm({ ...form, password: event.target.value })
                }
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            Demo credentials are pre-filled for the selected role. If the
            backend is unavailable, the app switches to mock data automatically.
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ activePage, setActivePage, role }) {
  return (
    <aside className="flex h-full w-full flex-col bg-slate-950 text-slate-100 lg:w-72">
      <div className="border-b border-slate-800 px-6 py-6">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Finance
        </div>
        <div className="mt-2 text-2xl font-semibold">Dashboard</div>
      </div>

      <nav className="flex-1 space-y-2 px-4 py-5">
        {NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActivePage(item.key)}
            className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
              activePage === item.key
                ? "bg-white/10 text-white"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="border-t border-slate-800 px-6 py-5 text-xs leading-6 text-slate-400">
        Dark sidebar, white content area, and role-based navigation tuned for a
        finance dashboard demo.
      </div>
    </aside>
  );
}

function TopBar({ session, dataMode, onLogout, pageTitle }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{pageTitle}</h1>
          <p className="text-sm text-slate-500">
            Connected to REST APIs with mock fallback for offline demos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={dataMode === "live" ? "green" : "amber"}>
            {dataMode === "live" ? "Live API" : "Demo data"}
          </Badge>
          <Badge
            tone={
              session.role === "admin"
                ? "blue"
                : session.role === "analyst"
                  ? "slate"
                  : "amber"
            }
          >
            Logged in as {prettyRole(session.role)}
          </Badge>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-950"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[1.75rem] bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-100"
          >
            Close
          </button>
        </div>
        <div className="mt-5">{children}</div>
        {footer ? (
          <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

function DashboardView({
  summary,
  monthlyTrends,
  recentTransactions,
  loading,
  error,
  onRetry,
}) {
  if (loading) {
    return <LoadingBlock message="Loading dashboard metrics..." />;
  }

  return (
    <div>
      <ErrorBanner message={error} onRetry={onRetry} />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total Income"
          value={formatCurrency(summary.totalIncome)}
          accent="text-emerald-600"
        />
        <StatCard
          label="Total Expenses"
          value={formatCurrency(summary.totalExpenses)}
          accent="text-rose-600"
        />
        <StatCard
          label="Net Balance"
          value={formatCurrency(summary.netBalance)}
          accent="text-sky-700"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Monthly Income vs Expense
              </h2>
              <p className="text-sm text-slate-500">
                A quick trend view for planning and analysis.
              </p>
            </div>
          </div>

          <div className="mt-5 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyTrends}
                margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  stroke="#64748b"
                />
                <YAxis
                  stroke="#64748b"
                  tickFormatter={(value) => `${Number(value) / 1000}k`}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  labelFormatter={(label) => formatMonth(label)}
                  contentStyle={{ borderRadius: 16, borderColor: "#cbd5e1" }}
                />
                <Legend />
                <Bar dataKey="income" fill="#059669" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expense" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Recent Transactions
              </h2>
              <p className="text-sm text-slate-500">
                Latest entries pulled from the backend or mock store.
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {recentTransactions.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {formatCurrency(entry.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={entry.type === "income" ? "green" : "rose"}>
                        {capitalize(entry.type)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {entry.categoryName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(entry.date)}
                    </td>
                  </tr>
                ))}
                {!recentTransactions.length ? (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-slate-500"
                      colSpan={4}
                    >
                      No recent transactions found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function TransactionFilters({ filters, categories, onChange, onReset }) {
  return (
    <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] lg:grid-cols-5">
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Start date
        </label>
        <input
          type="date"
          value={filters.startDate}
          onChange={(event) =>
            onChange({ ...filters, startDate: event.target.value, page: 1 })
          }
          className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          End date
        </label>
        <input
          type="date"
          value={filters.endDate}
          onChange={(event) =>
            onChange({ ...filters, endDate: event.target.value, page: 1 })
          }
          className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Category
        </label>
        <select
          value={filters.category}
          onChange={(event) =>
            onChange({ ...filters, category: event.target.value, page: 1 })
          }
          className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
        >
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.name}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Type
        </label>
        <select
          value={filters.type}
          onChange={(event) =>
            onChange({ ...filters, type: event.target.value, page: 1 })
          }
          className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
        >
          <option value="all">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Page size
          </label>
          <select
            value={filters.pageSize}
            onChange={(event) =>
              onChange({
                ...filters,
                pageSize: Number(event.target.value),
                page: 1,
              })
            }
            className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
          >
            {[5, 10, 20].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-950"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function TransactionsTable({
  transactions,
  pagination,
  loading,
  error,
  onRetry,
  role,
  onAdd,
  onEdit,
  onDelete,
  onPageChange,
}) {
  if (loading) {
    return <LoadingBlock message="Loading transactions..." />;
  }

  return (
    <div>
      <ErrorBanner message={error} onRetry={onRetry} />

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Financial Records
            </h2>
            <p className="text-sm text-slate-500">
              Filter by date, category, and type. Admins can create and manage
              records.
            </p>
          </div>

          {role === "admin" ? (
            <button
              type="button"
              onClick={onAdd}
              className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Add Transaction
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Notes</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {transactions.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="px-5 py-4 font-semibold text-slate-900">
                    {formatCurrency(entry.amount)}
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={entry.type === "income" ? "green" : "rose"}>
                      {capitalize(entry.type)}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {entry.categoryName}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {formatDate(entry.date)}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {entry.notes || "-"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {role === "admin" ? (
                      <div className="inline-flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(entry)}
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(entry)}
                          className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Read only</span>
                    )}
                  </td>
                </tr>
              ))}

              {!transactions.length ? (
                <tr>
                  <td
                    className="px-5 py-8 text-center text-slate-500"
                    colSpan={6}
                  >
                    No transactions match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            Page {pagination.page} of {pagination.totalPages} ·{" "}
            {pagination.totalItems} records
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersTable({
  users,
  loading,
  error,
  onRetry,
  onStatusChange,
  onRoleChange,
  currentUserId,
}) {
  if (loading) {
    return <LoadingBlock message="Loading users..." />;
  }

  return (
    <div>
      <ErrorBanner message={error} onRetry={onRetry} />

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Users</h2>
          <p className="text-sm text-slate-500">
            Admin-only user administration with role and status controls.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {users.map((user) => (
                <tr
                  key={user.id}
                  className={user.id === currentUserId ? "bg-slate-50/70" : ""}
                >
                  <td className="px-5 py-4 font-semibold text-slate-900">
                    {user.name}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{user.email}</td>
                  <td className="px-5 py-4">
                    <select
                      value={user.role}
                      onChange={(event) =>
                        onRoleChange(user, event.target.value)
                      }
                      className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={user.status === "active" ? "green" : "amber"}>
                      {capitalize(user.status)}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => onStatusChange(user)}
                      className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      {user.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}

              {!users.length ? (
                <tr>
                  <td
                    className="px-5 py-8 text-center text-slate-500"
                    colSpan={5}
                  >
                    No users available.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function FinanceDashboard() {
  const [session, setSession] = useState(() => readStoredSession());
  const [authForm, setAuthForm] = useState({
    role: "viewer",
    email: DEMO_ACCOUNTS.viewer.email,
    password: DEMO_ACCOUNTS.viewer.password,
  });
  const [activePage, setActivePage] = useState("dashboard");
  const [dataMode, setDataMode] = useState(
    session?.token?.startsWith("mock-jwt") ? "mock" : session ? "live" : "mock",
  );
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState("create");
  const [editingTransactionId, setEditingTransactionId] = useState(null);
  const [transactionForm, setTransactionForm] = useState({
    amount: "",
    type: "expense",
    categoryId: "",
    date: todayString(),
    notes: "",
  });
  const [transactionFilters, setTransactionFilters] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    startDate: "",
    endDate: "",
    category: "all",
    type: "all",
  });
  const [mockStore, setMockStore] = useState(() => clone(MOCK_STORE));
  const [liveData, setLiveData] = useState({
    categories: [],
    summary: { totalIncome: 0, totalExpenses: 0, netBalance: 0 },
    monthlyTrends: [],
    recentTransactions: [],
    transactionPage: {
      items: [],
      pagination: {
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        totalItems: 0,
        totalPages: 1,
      },
    },
    usersPage: {
      items: [],
      pagination: {
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        totalItems: 0,
        totalPages: 1,
      },
    },
  });

  const currentToken = session?.token || "";
  const currentRole = session?.role || "viewer";
  const pageTitleMap = {
    dashboard: "Dashboard",
    transactions: "Transactions",
    users: "Users",
  };

  const currentCategories =
    dataMode === "live" ? liveData.categories : mockStore.categories;
  const currentSummary =
    dataMode === "live"
      ? liveData.summary
      : deriveSummary(mockStore.transactions);
  const currentMonthlyTrends =
    dataMode === "live"
      ? liveData.monthlyTrends
      : deriveMonthlyTrends(mockStore.transactions);
  const currentRecentTransactions =
    dataMode === "live"
      ? liveData.recentTransactions
      : [...mockStore.transactions]
          .sort((left, right) => right.date.localeCompare(left.date))
          .slice(0, 10);
  const currentTransactionsPage =
    dataMode === "live"
      ? liveData.transactionPage
      : paginateTransactions(
          filterTransactions(mockStore.transactions, transactionFilters),
          transactionFilters.page,
          transactionFilters.pageSize,
        );
  const currentUsersPage =
    dataMode === "live"
      ? liveData.usersPage
      : {
          items: mockStore.users,
          pagination: {
            page: 1,
            pageSize: DEFAULT_PAGE_SIZE,
            totalItems: mockStore.users.length,
            totalPages: Math.max(
              1,
              Math.ceil(mockStore.users.length / DEFAULT_PAGE_SIZE),
            ),
          },
        };

  useEffect(() => {
    if (currentRole !== "admin" && activePage === "users") {
      setActivePage("dashboard");
    }
  }, [activePage, currentRole]);

  useEffect(() => {
    if (!session) {
      return;
    }

    saveStoredSession(session);
  }, [session]);

  useEffect(() => {
    if (!session || dataMode !== "live") {
      return;
    }

    let cancelled = false;

    async function loadDashboardData() {
      setDashboardLoading(true);
      setDashboardError("");

      const dashboardSummaryCandidates = [
        "/api/dashboard/summary",
        "/api/v1/dashboard/summary",
      ];
      const dashboardTrendCandidates = [
        "/api/dashboard/monthly-trends",
        "/api/v1/dashboard/monthly-trends",
      ];
      const recentCandidates = [
        "/api/transactions?limit=10",
        "/api/v1/records?page=1&page_size=10",
      ];
      const categoryCandidates = [
        "/api/categories?page=1&page_size=100",
        "/api/v1/categories?page=1&page_size=100",
      ];

      try {
        const [
          summaryPayload,
          trendsPayload,
          recentPayload,
          categoriesPayload,
        ] = await Promise.all([
          fetchFirstJson(dashboardSummaryCandidates, currentToken),
          fetchFirstJson(dashboardTrendCandidates, currentToken),
          fetchFirstJson(recentCandidates, currentToken),
          fetchFirstJson(categoryCandidates, currentToken),
        ]);

        if (cancelled) {
          return;
        }

        setLiveData((previous) => ({
          ...previous,
          summary: normalizeSummary(summaryPayload),
          monthlyTrends: normalizeMonthlyTrends(trendsPayload),
          recentTransactions: normalizeTransactionList(recentPayload).slice(
            0,
            10,
          ),
          categories: normalizeCategoryList(categoriesPayload),
        }));
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error.status === 401 || error.status === 403) {
          setDashboardError(
            error.detail ||
              (error.status === 403
                ? "403 Forbidden — You don't have permission."
                : "Unauthorized."),
          );
          setDashboardLoading(false);
          return;
        }

        if (shouldUseMockFallback(error)) {
          setDataMode("mock");
          setLiveData({
            categories: [],
            summary: { totalIncome: 0, totalExpenses: 0, netBalance: 0 },
            monthlyTrends: [],
            recentTransactions: [],
            transactionPage: {
              items: [],
              pagination: {
                page: 1,
                pageSize: DEFAULT_PAGE_SIZE,
                totalItems: 0,
                totalPages: 1,
              },
            },
            usersPage: {
              items: [],
              pagination: {
                page: 1,
                pageSize: DEFAULT_PAGE_SIZE,
                totalItems: 0,
                totalPages: 1,
              },
            },
          });
        } else {
          setDashboardError(error.detail || "Failed to load dashboard data.");
        }
      } finally {
        if (!cancelled) {
          setDashboardLoading(false);
        }
      }
    }

    loadDashboardData();

    return () => {
      cancelled = true;
    };
  }, [session, dataMode, currentToken]);

  useEffect(() => {
    if (!session || dataMode !== "live" || activePage !== "transactions") {
      return;
    }

    let cancelled = false;

    async function loadTransactions() {
      setTransactionsLoading(true);
      setTransactionsError("");

      const params = buildQuery({
        page: transactionFilters.page,
        page_size: transactionFilters.pageSize,
        start_date: transactionFilters.startDate,
        end_date: transactionFilters.endDate,
        category: transactionFilters.category,
        type: transactionFilters.type,
      });
      const candidates = [
        `/api/transactions${params}`,
        `/api/v1/records${params}`,
      ];

      try {
        const payload = await fetchFirstJson(candidates, currentToken);
        if (cancelled) {
          return;
        }

        const items = normalizeTransactionList(payload);
        setLiveData((previous) => ({
          ...previous,
          transactionPage: {
            items,
            pagination: extractPagination(
              payload,
              transactionFilters.page,
              transactionFilters.pageSize,
              items.length,
            ),
          },
        }));
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error.status === 401 || error.status === 403) {
          setTransactionsError(
            error.detail ||
              (error.status === 403
                ? "403 Forbidden — You don't have permission."
                : "Unauthorized."),
          );
          setTransactionsLoading(false);
          return;
        }

        if (shouldUseMockFallback(error)) {
          setDataMode("mock");
        } else {
          setTransactionsError(error.detail || "Failed to load transactions.");
        }
      } finally {
        if (!cancelled) {
          setTransactionsLoading(false);
        }
      }
    }

    loadTransactions();

    return () => {
      cancelled = true;
    };
  }, [activePage, session, dataMode, transactionFilters, currentToken]);

  useEffect(() => {
    if (
      !session ||
      dataMode !== "live" ||
      activePage !== "users" ||
      currentRole !== "admin"
    ) {
      return;
    }

    let cancelled = false;

    async function loadUsers() {
      setUsersLoading(true);
      setUsersError("");

      const candidates = [
        "/api/users?page=1&page_size=100",
        "/api/v1/users?page=1&page_size=100",
      ];

      try {
        const payload = await fetchFirstJson(candidates, currentToken);
        if (cancelled) {
          return;
        }

        const items = normalizeUserList(payload);
        setLiveData((previous) => ({
          ...previous,
          usersPage: {
            items,
            pagination: extractPagination(payload, 1, 100, items.length),
          },
        }));
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error.status === 401 || error.status === 403) {
          setUsersError(
            error.detail ||
              (error.status === 403
                ? "403 Forbidden — You don't have permission."
                : "Unauthorized."),
          );
          setUsersLoading(false);
          return;
        }

        if (shouldUseMockFallback(error)) {
          setDataMode("mock");
        } else {
          setUsersError(error.detail || "Failed to load users.");
        }
      } finally {
        if (!cancelled) {
          setUsersLoading(false);
        }
      }
    }

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, [activePage, session, dataMode, currentRole, currentToken]);

  useEffect(() => {
    if (currentRole !== "admin" && activePage === "users") {
      setActivePage("dashboard");
    }
  }, [currentRole, activePage]);

  useEffect(() => {
    if (!editorOpen) {
      return;
    }

    const matchingCategories = currentCategories.filter(
      (category) =>
        category.isActive && category.recordType === transactionForm.type,
    );
    if (!matchingCategories.length) {
      return;
    }

    if (
      !matchingCategories.some(
        (category) =>
          String(category.id) === String(transactionForm.categoryId),
      )
    ) {
      setTransactionForm((previous) => ({
        ...previous,
        categoryId: String(matchingCategories[0].id),
      }));
    }
  }, [editorOpen, transactionForm.type, currentCategories]);

  async function performLogin(event) {
    event.preventDefault();
    setLoginError("");

    const email = normalizeText(authForm.email);
    const password = normalizeText(authForm.password);

    if (!email || !password) {
      setLoginError("Email and password are required.");
      return;
    }

    setLoginLoading(true);

    const authCandidates = ["/api/auth/login", "/api/v1/auth/login"];

    try {
      const payload = await fetchFirstJson(authCandidates, "", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const resolvedRole = payload?.user?.role || authForm.role;
      const nextSession = {
        token: payload.access_token,
        role: resolvedRole,
        user: payload.user || {
          id: 0,
          name: DEMO_ACCOUNTS[resolvedRole]?.name || "User",
          email,
          role: resolvedRole,
          status: "active",
        },
      };

      setSession(nextSession);
      setDataMode("live");
      setActivePage("dashboard");
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        setLoginError(
          error.detail ||
            (error.status === 403
              ? "403 Forbidden — You don't have permission."
              : "Invalid credentials."),
        );
        setLoginLoading(false);
        return;
      }

      if (shouldUseMockFallback(error)) {
        const demoSession = {
          token: `mock-jwt.${authForm.role}.${Date.now()}`,
          role: authForm.role,
          user: {
            id: 0,
            name: DEMO_ACCOUNTS[authForm.role]?.name || "Demo User",
            email,
            role: authForm.role,
            status: "active",
          },
        };

        setMockStore(clone(MOCK_STORE));
        setSession(demoSession);
        setDataMode("mock");
        setActivePage("dashboard");
      } else {
        setLoginError(error.detail || "Unable to sign in.");
      }
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    setSession(null);
    saveStoredSession(null);
    setActivePage("dashboard");
    setDataMode("mock");
    setLoginError("");
    setDashboardError("");
    setTransactionsError("");
    setUsersError("");
  }

  async function reloadDashboard() {
    if (!session) {
      return;
    }

    if (dataMode === "mock") {
      setDashboardError("");
      return;
    }

    setDashboardLoading(true);
    setDashboardError("");

    try {
      const [summaryPayload, trendsPayload, recentPayload, categoriesPayload] =
        await Promise.all([
          fetchFirstJson(
            ["/api/dashboard/summary", "/api/v1/dashboard/summary"],
            currentToken,
          ),
          fetchFirstJson(
            [
              "/api/dashboard/monthly-trends",
              "/api/v1/dashboard/monthly-trends",
            ],
            currentToken,
          ),
          fetchFirstJson(
            [
              "/api/transactions?limit=10",
              "/api/v1/records?page=1&page_size=10",
            ],
            currentToken,
          ),
          fetchFirstJson(
            [
              "/api/categories?page=1&page_size=100",
              "/api/v1/categories?page=1&page_size=100",
            ],
            currentToken,
          ),
        ]);

      setLiveData((previous) => ({
        ...previous,
        summary: normalizeSummary(summaryPayload),
        monthlyTrends: normalizeMonthlyTrends(trendsPayload),
        recentTransactions: normalizeTransactionList(recentPayload).slice(
          0,
          10,
        ),
        categories: normalizeCategoryList(categoriesPayload),
      }));
      setDataMode("live");
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        setDashboardError(
          error.detail ||
            (error.status === 403
              ? "403 Forbidden — You don't have permission."
              : "Unauthorized."),
        );
      } else {
        if (shouldUseMockFallback(error)) {
          setDataMode("mock");
        } else {
          setDashboardError(error.detail || "Failed to load dashboard data.");
        }
      }
    } finally {
      setDashboardLoading(false);
    }
  }

  async function reloadTransactions(nextFilters = transactionFilters) {
    if (!session) {
      return;
    }

    if (dataMode === "mock") {
      setTransactionsError("");
      return;
    }

    setTransactionsLoading(true);
    setTransactionsError("");

    const params = buildQuery({
      page: nextFilters.page,
      page_size: nextFilters.pageSize,
      start_date: nextFilters.startDate,
      end_date: nextFilters.endDate,
      category: nextFilters.category,
      type: nextFilters.type,
    });

    try {
      const payload = await fetchFirstJson(
        [`/api/transactions${params}`, `/api/v1/records${params}`],
        currentToken,
      );
      const items = normalizeTransactionList(payload);
      setLiveData((previous) => ({
        ...previous,
        transactionPage: {
          items,
          pagination: extractPagination(
            payload,
            nextFilters.page,
            nextFilters.pageSize,
            items.length,
          ),
        },
      }));
      setDataMode("live");
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        setTransactionsError(
          error.detail ||
            (error.status === 403
              ? "403 Forbidden — You don't have permission."
              : "Unauthorized."),
        );
      } else {
        if (shouldUseMockFallback(error)) {
          setDataMode("mock");
        } else {
          setTransactionsError(error.detail || "Failed to load transactions.");
        }
      }
    } finally {
      setTransactionsLoading(false);
    }
  }

  async function reloadUsers() {
    if (!session || currentRole !== "admin") {
      return;
    }

    if (dataMode === "mock") {
      setUsersError("");
      return;
    }

    setUsersLoading(true);
    setUsersError("");

    try {
      const payload = await fetchFirstJson(
        [
          "/api/users?page=1&page_size=100",
          "/api/v1/users?page=1&page_size=100",
        ],
        currentToken,
      );
      const items = normalizeUserList(payload);
      setLiveData((previous) => ({
        ...previous,
        usersPage: {
          items,
          pagination: extractPagination(payload, 1, 100, items.length),
        },
      }));
      setDataMode("live");
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        setUsersError(
          error.detail ||
            (error.status === 403
              ? "403 Forbidden — You don't have permission."
              : "Unauthorized."),
        );
      } else {
        if (shouldUseMockFallback(error)) {
          setDataMode("mock");
        } else {
          setUsersError(error.detail || "Failed to load users.");
        }
      }
    } finally {
      setUsersLoading(false);
    }
  }

  function openCreateTransaction() {
    const firstMatchingCategory =
      currentCategories.find(
        (category) => category.isActive && category.recordType === "expense",
      ) ||
      currentCategories.find((category) => category.isActive) ||
      currentCategories[0];

    setEditorMode("create");
    setEditingTransactionId(null);
    setTransactionForm({
      amount: "",
      type: "expense",
      categoryId: firstMatchingCategory ? String(firstMatchingCategory.id) : "",
      date: todayString(),
      notes: "",
    });
    setEditorOpen(true);
  }

  function openEditTransaction(entry) {
    setEditorMode("edit");
    setEditingTransactionId(entry.id);
    setTransactionForm({
      amount: String(entry.amount),
      type: entry.type,
      categoryId: String(entry.categoryId || ""),
      date: entry.date,
      notes: entry.notes || "",
    });
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingTransactionId(null);
  }

  async function saveTransaction(event) {
    event.preventDefault();

    if (currentRole !== "admin") {
      return;
    }

    const payload = {
      amount: parseAmount(transactionForm.amount),
      type: transactionForm.type,
      category_id: Number(transactionForm.categoryId),
      date: transactionForm.date,
      notes: normalizeText(transactionForm.notes),
    };

    if (!payload.category_id || !payload.date || !payload.amount) {
      setTransactionsError(
        "Please complete the transaction form before saving.",
      );
      return;
    }

    setBusyKey("transaction-form");
    setTransactionsError("");

    if (dataMode === "mock") {
      const selectedCategory =
        mockStore.categories.find(
          (category) => category.id === payload.category_id,
        ) ||
        currentCategories.find(
          (category) => category.id === payload.category_id,
        );
      const nextTransaction = {
        id:
          editorMode === "edit" && editingTransactionId
            ? editingTransactionId
            : Math.max(0, ...mockStore.transactions.map((entry) => entry.id)) +
              1,
        amount: payload.amount,
        type: payload.type,
        categoryId: payload.category_id,
        categoryName: selectedCategory?.name || "Uncategorized",
        date: payload.date,
        notes: payload.notes,
      };

      setMockStore((previous) => {
        const nextTransactions =
          editorMode === "edit"
            ? previous.transactions.map((entry) =>
                entry.id === editingTransactionId ? nextTransaction : entry,
              )
            : [nextTransaction, ...previous.transactions];
        return { ...previous, transactions: nextTransactions };
      });
      closeEditor();
      setBusyKey("");
      return;
    }

    const endpoint =
      editorMode === "edit"
        ? [
            `/api/transactions/${editingTransactionId}`,
            `/api/v1/records/${editingTransactionId}`,
          ]
        : ["/api/transactions", "/api/v1/records"];
    const method = editorMode === "edit" ? "PATCH" : "POST";

    try {
      await fetchFirstJson(endpoint, currentToken, {
        method,
        body: JSON.stringify(payload),
      });
      closeEditor();
      await Promise.all([
        reloadDashboard(),
        reloadTransactions(transactionFilters),
      ]);
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        setTransactionsError(
          error.detail ||
            (error.status === 403
              ? "403 Forbidden — You don't have permission."
              : "Unauthorized."),
        );
      } else {
        if (shouldUseMockFallback(error)) {
          setDataMode("mock");
        } else {
          setTransactionsError(error.detail || "Failed to save transaction.");
        }
      }
    } finally {
      setBusyKey("");
    }
  }

  async function deleteTransaction(entry) {
    if (currentRole !== "admin") {
      return;
    }

    if (!isBrowser() || !window.confirm(`Delete transaction ${entry.id}?`)) {
      return;
    }

    setBusyKey(`delete-${entry.id}`);
    setTransactionsError("");

    if (dataMode === "mock") {
      setMockStore((previous) => ({
        ...previous,
        transactions: previous.transactions.filter(
          (item) => item.id !== entry.id,
        ),
      }));
      setBusyKey("");
      return;
    }

    try {
      await fetchFirstJson(
        [`/api/transactions/${entry.id}`, `/api/v1/records/${entry.id}`],
        currentToken,
        { method: "DELETE" },
      );
      await Promise.all([
        reloadDashboard(),
        reloadTransactions(transactionFilters),
      ]);
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        setTransactionsError(
          error.detail ||
            (error.status === 403
              ? "403 Forbidden — You don't have permission."
              : "Unauthorized."),
        );
      } else {
        if (shouldUseMockFallback(error)) {
          setDataMode("mock");
        } else {
          setTransactionsError(error.detail || "Failed to delete transaction.");
        }
      }
    } finally {
      setBusyKey("");
    }
  }

  async function changeUserStatus(user) {
    if (currentRole !== "admin") {
      return;
    }

    const nextStatus = user.status === "active" ? "inactive" : "active";
    setBusyKey(`user-status-${user.id}`);
    setUsersError("");

    if (dataMode === "mock") {
      setMockStore((previous) => ({
        ...previous,
        users: previous.users.map((item) =>
          item.id === user.id ? { ...item, status: nextStatus } : item,
        ),
      }));

      if (session?.user?.id === user.id) {
        setSession((previous) =>
          previous
            ? {
                ...previous,
                role: user.role,
                user: { ...previous.user, status: nextStatus },
              }
            : previous,
        );
      }

      setBusyKey("");
      return;
    }

    try {
      await fetchFirstJson(
        [`/api/users/${user.id}`, `/api/v1/users/${user.id}`],
        currentToken,
        {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      await reloadUsers();
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        setUsersError(
          error.detail ||
            (error.status === 403
              ? "403 Forbidden — You don't have permission."
              : "Unauthorized."),
        );
      } else {
        if (shouldUseMockFallback(error)) {
          setDataMode("mock");
        } else {
          setUsersError(error.detail || "Failed to update user status.");
        }
      }
    } finally {
      setBusyKey("");
    }
  }

  async function changeUserRole(user, nextRole) {
    if (currentRole !== "admin") {
      return;
    }

    setBusyKey(`user-role-${user.id}`);
    setUsersError("");

    if (dataMode === "mock") {
      setMockStore((previous) => ({
        ...previous,
        users: previous.users.map((item) =>
          item.id === user.id ? { ...item, role: nextRole } : item,
        ),
      }));

      if (session?.user?.id === user.id) {
        setSession((previous) =>
          previous
            ? {
                ...previous,
                role: nextRole,
                user: { ...previous.user, role: nextRole },
              }
            : previous,
        );
      }

      setBusyKey("");
      return;
    }

    try {
      await fetchFirstJson(
        [`/api/users/${user.id}`, `/api/v1/users/${user.id}`],
        currentToken,
        {
          method: "PATCH",
          body: JSON.stringify({ role: nextRole }),
        },
      );
      await reloadUsers();
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        setUsersError(
          error.detail ||
            (error.status === 403
              ? "403 Forbidden — You don't have permission."
              : "Unauthorized."),
        );
      } else {
        if (shouldUseMockFallback(error)) {
          setDataMode("mock");
        } else {
          setUsersError(error.detail || "Failed to update user role.");
        }
      }
    } finally {
      setBusyKey("");
    }
  }

  function handleTransactionFilterChange(nextFilters) {
    setTransactionFilters(nextFilters);
  }

  function resetTransactionFilters() {
    setTransactionFilters({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      startDate: "",
      endDate: "",
      category: "all",
      type: "all",
    });
  }

  const activePageTitle = pageTitleMap[activePage] || "Dashboard";

  if (!session) {
    return (
      <LoginPage
        form={authForm}
        setForm={setAuthForm}
        error={loginError}
        loading={loginLoading}
        onSubmit={performLogin}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 lg:flex">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        role={currentRole}
      />

      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar
          session={session}
          dataMode={dataMode}
          onLogout={handleLogout}
          pageTitle={activePageTitle}
        />

        <main className="flex-1 px-5 py-6 lg:px-8">
          {activePage === "dashboard" ? (
            <div className="space-y-6">
              <DashboardView
                summary={currentSummary}
                monthlyTrends={currentMonthlyTrends}
                recentTransactions={currentRecentTransactions}
                loading={dashboardLoading}
                error={dashboardError}
                onRetry={reloadDashboard}
              />
            </div>
          ) : null}

          {activePage === "transactions" ? (
            <div className="space-y-6">
              <TransactionFilters
                filters={transactionFilters}
                categories={currentCategories}
                onChange={handleTransactionFilterChange}
                onReset={resetTransactionFilters}
              />

              <TransactionsTable
                transactions={currentTransactionsPage.items}
                pagination={currentTransactionsPage.pagination}
                loading={transactionsLoading}
                error={transactionsError}
                onRetry={() => reloadTransactions(transactionFilters)}
                role={currentRole}
                onAdd={openCreateTransaction}
                onEdit={openEditTransaction}
                onDelete={deleteTransaction}
                onPageChange={(page) => {
                  const nextFilters = { ...transactionFilters, page };
                  setTransactionFilters(nextFilters);
                  if (dataMode === "live") {
                    reloadTransactions(nextFilters);
                  }
                }}
              />
            </div>
          ) : null}

          {activePage === "users" && currentRole === "admin" ? (
            <UsersTable
              users={currentUsersPage.items}
              loading={usersLoading}
              error={usersError}
              onRetry={reloadUsers}
              onStatusChange={changeUserStatus}
              onRoleChange={changeUserRole}
              currentUserId={session.user?.id}
            />
          ) : null}
        </main>
      </div>

      {editorOpen ? (
        <Modal
          title={editorMode === "edit" ? "Edit Transaction" : "Add Transaction"}
          onClose={closeEditor}
          footer={
            <>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveTransaction}
                disabled={busyKey === "transaction-form"}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {busyKey === "transaction-form"
                  ? "Saving..."
                  : "Save Transaction"}
              </button>
            </>
          }
        >
          <form
            onSubmit={saveTransaction}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Amount
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={transactionForm.amount}
                onChange={(event) =>
                  setTransactionForm({
                    ...transactionForm,
                    amount: event.target.value,
                  })
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Type
              </label>
              <select
                value={transactionForm.type}
                onChange={(event) =>
                  setTransactionForm({
                    ...transactionForm,
                    type: event.target.value,
                  })
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Category
              </label>
              <select
                value={transactionForm.categoryId}
                onChange={(event) =>
                  setTransactionForm({
                    ...transactionForm,
                    categoryId: event.target.value,
                  })
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
              >
                {currentCategories
                  .filter(
                    (category) =>
                      category.isActive &&
                      category.recordType === transactionForm.type,
                  )
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Date
              </label>
              <input
                type="date"
                value={transactionForm.date}
                onChange={(event) =>
                  setTransactionForm({
                    ...transactionForm,
                    date: event.target.value,
                  })
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Notes
              </label>
              <textarea
                value={transactionForm.notes}
                onChange={(event) =>
                  setTransactionForm({
                    ...transactionForm,
                    notes: event.target.value,
                  })
                }
                rows={4}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
              />
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
