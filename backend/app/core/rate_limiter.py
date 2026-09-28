import time
from collections import defaultdict
from typing import Dict, List
from fastapi import HTTPException, status
from app.core.config import settings


class InMemoryRateLimiter:
    """
    Lightweight, thread-safe in-memory sliding-window rate limiter.
    Provides abuse and denial-of-service protection for AI and sensitive endpoints
    without requiring external infrastructure (e.g. Redis).
    """

    def __init__(self, requests_per_minute: int = 30):
        self.requests_per_minute = requests_per_minute
        self._user_requests: Dict[int, List[float]] = defaultdict(list)

    def check_rate_limit(self, user_id: int) -> None:
        """
        Check if the user has exceeded their request quota within the 60-second window.
        Raises HTTP 429 Too Many Requests if the limit is exceeded.
        """
        now = time.time()
        window_start = now - 60.0

        # Filter out requests older than the sliding window
        valid_timestamps = [t for t in self._user_requests[user_id] if t > window_start]
        self._user_requests[user_id] = valid_timestamps

        if len(valid_timestamps) >= self.requests_per_minute:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please wait a moment before sending another request.",
            )

        self._user_requests[user_id].append(now)

    def reset(self) -> None:
        """Reset rate limiter state (useful in testing)."""
        self._user_requests.clear()


ai_rate_limiter = InMemoryRateLimiter(requests_per_minute=settings.AI_RATE_LIMIT_PER_MINUTE)
