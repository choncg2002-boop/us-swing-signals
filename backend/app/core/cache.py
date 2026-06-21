import hashlib
import json
import time
from pathlib import Path
from typing import Any, Optional

try:
    import redis

    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

from app.config import get_settings
from app.core.paths import get_cache_dir


class CacheManager:
    """Multi-layer cache: Redis (primary) -> file fallback."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self._redis: Optional["redis.Redis"] = None
        self._file_cache_dir = get_cache_dir()

        if self.settings.use_redis and REDIS_AVAILABLE:
            try:
                self._redis = redis.from_url(self.settings.redis_url, decode_responses=True)
                self._redis.ping()
            except Exception:
                self._redis = None

    def _key_path(self, key: str) -> Path:
        hashed = hashlib.md5(key.encode()).hexdigest()
        return self._file_cache_dir / f"{hashed}.json"

    def get(self, key: str) -> Optional[Any]:
        if self._redis:
            raw = self._redis.get(key)
            if raw:
                return json.loads(raw)

        path = self._key_path(key)
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            if data.get("expires_at", 0) > time.time():
                return data["value"]
            path.unlink(missing_ok=True)
        return None

    def set(self, key: str, value: Any, ttl: int = 300) -> None:
        if self._redis:
            self._redis.setex(key, ttl, json.dumps(value, default=str))

        payload = {"value": value, "expires_at": time.time() + ttl}
        self._key_path(key).write_text(
            json.dumps(payload, default=str), encoding="utf-8"
        )

    def delete(self, key: str) -> None:
        if self._redis:
            self._redis.delete(key)
        self._key_path(key).unlink(missing_ok=True)


cache = CacheManager()
