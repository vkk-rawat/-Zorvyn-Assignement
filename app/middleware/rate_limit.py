from __future__ import annotations

from collections import defaultdict, deque
from collections.abc import Iterable
from threading import Lock
from time import monotonic
from typing import Optional

from fastapi import status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp


class InMemoryRateLimiter(BaseHTTPMiddleware):
    """
    Lightweight in-memory rate limiter.

    This is suitable for local development and single-instance deployments.
    For distributed production systems, replace it with Redis or API gateway
    based throttling.
    """

    def __init__(
        self,
        app: ASGIApp,
        max_requests: int,
        window_seconds: int,
        protected_paths: Optional[Iterable[str]] = None,
    ) -> None:
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.protected_paths = tuple(protected_paths or [])
        self._buckets: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = Lock()

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if self.protected_paths and not any(path.startswith(prefix) for prefix in self.protected_paths):
            return await call_next(request)

        client_host = request.client.host if request.client else "unknown"
        bucket_key = (client_host, path)
        current_time = monotonic()

        with self._lock:
            bucket = self._buckets[bucket_key]
            while bucket and current_time - bucket[0] >= self.window_seconds:
                bucket.popleft()

            if len(bucket) >= self.max_requests:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Rate limit exceeded. Please try again later."},
                )

            bucket.append(current_time)

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.max_requests)
        response.headers["X-RateLimit-Window"] = str(self.window_seconds)
        return response
