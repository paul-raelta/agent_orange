"""Token-bucket rate limiter (async). Used by EDGAR (8 req/s) and Finnhub (50/min).

`acquire()` blocks until a token is available. Multiple coroutines can wait
concurrently — first-come-first-served via an asyncio.Lock.
"""
from __future__ import annotations

import asyncio
import time


class TokenBucket:
    def __init__(self, rate_per_sec: float, capacity: float | None = None) -> None:
        self.rate = rate_per_sec
        self.capacity = capacity if capacity is not None else rate_per_sec
        self.tokens = self.capacity
        self.last = time.monotonic()
        self._lock = asyncio.Lock()

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self.last
        self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
        self.last = now

    async def acquire(self, cost: float = 1.0) -> None:
        async with self._lock:
            self._refill()
            while self.tokens < cost:
                deficit = cost - self.tokens
                wait_s = deficit / self.rate
                await asyncio.sleep(wait_s)
                self._refill()
            self.tokens -= cost
