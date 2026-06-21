import time
from functools import wraps
from typing import Callable, TypeVar

from app.config import get_settings

T = TypeVar("T")


class RateLimiter:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._last_call = 0.0
        self._min_interval = self.settings.batch_delay_sec

    def sync_wait(self) -> None:
        elapsed = time.monotonic() - self._last_call
        if elapsed < self._min_interval:
            time.sleep(self._min_interval - elapsed)
        self._last_call = time.monotonic()


rate_limiter = RateLimiter()


def with_retry(max_retries: int | None = None) -> Callable[[Callable[..., T]], Callable[..., T]]:
    settings = get_settings()
    retries = max_retries or settings.max_retries

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            last_error: Exception | None = None
            for attempt in range(retries):
                try:
                    return func(*args, **kwargs)
                except Exception as exc:
                    last_error = exc
                    wait = settings.backoff_base_sec * (2**attempt)
                    time.sleep(wait)
            if last_error:
                raise last_error
            raise RuntimeError("Retry failed without exception")

        return wrapper

    return decorator
