"""
Cross-platform runtime path resolution.

Prefers configurable env vars, then platform cache dirs (ASCII-safe on Windows),
so projects in non-ASCII folders (e.g. Thai paths) still work with curl/yfinance.
"""

from __future__ import annotations

import os
import shutil
import sys
import tempfile
from functools import lru_cache
from pathlib import Path

try:
    from platformdirs import user_cache_dir
except ImportError:
    user_cache_dir = None  # type: ignore[assignment]

APP_SLUG = "us-swing-signals"

ENV_RUNTIME_DIR = "RUNTIME_DIR"
ENV_CACHE_DIR = "CACHE_DIR"
ENV_YFINANCE_CACHE_DIR = "YFINANCE_CACHE_DIR"

# Legacy aliases (still supported)
ENV_RUNTIME_DIR_LEGACY = "US_SWING_RUNTIME_DIR"
ENV_CACHE_DIR_LEGACY = "US_SWING_CACHE_DIR"


def _env_path(*keys: str) -> Path | None:
    for key in keys:
        value = os.environ.get(key)
        if value:
            return _ensure_dir(Path(value))
    return None


def path_is_ascii_safe(path: Path | str) -> bool:
    try:
        os.fsencode(str(path))
        str(path).encode("ascii")
        return True
    except (UnicodeEncodeError, UnicodeDecodeError, ValueError):
        return False


def _ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def _default_runtime_root() -> Path:
    resolved = _env_path(ENV_RUNTIME_DIR, ENV_RUNTIME_DIR_LEGACY)
    if resolved:
        return resolved

    if user_cache_dir is not None:
        return _ensure_dir(Path(user_cache_dir(APP_SLUG, appauthor=False)))

    # Fallback: system temp (always ASCII on Windows)
    return _ensure_dir(Path(tempfile.gettempdir()) / APP_SLUG)


@lru_cache
def get_runtime_root() -> Path:
    return _default_runtime_root()


def get_cache_dir() -> Path:
    resolved = _env_path(ENV_CACHE_DIR, ENV_CACHE_DIR_LEGACY)
    if resolved:
        return resolved
    return _ensure_dir(get_runtime_root() / "cache")


def get_yfinance_cache_dir() -> Path:
    resolved = _env_path(ENV_YFINANCE_CACHE_DIR)
    if resolved:
        return resolved
    return _ensure_dir(get_runtime_root() / "yfinance")


def get_ssl_cert_bundle() -> Path:
    """
    Return a CA bundle path safe for curl_cffi on Windows.

    Copies certifi bundle to runtime dir when the source path is not ASCII-safe.
    """
    import certifi

    source = Path(certifi.where())
    if path_is_ascii_safe(source):
        return source

    target = get_runtime_root() / "cacert.pem"
    if not target.exists() or target.stat().st_mtime < source.stat().st_mtime:
        shutil.copy(source, target)
    return target


def configure_yfinance_environment() -> None:
    """Set env vars once before importing yfinance (idempotent)."""
    yf_cache = str(get_yfinance_cache_dir())
    os.environ.setdefault(ENV_YFINANCE_CACHE_DIR, yf_cache)

    ca_bundle = str(get_ssl_cert_bundle())
    os.environ.setdefault("CURL_CA_BUNDLE", ca_bundle)
    os.environ.setdefault("SSL_CERT_FILE", ca_bundle)

    if sys.platform == "win32":
        os.environ.setdefault("PYTHONUTF8", "1")


def resolve_paths_from_settings(
    runtime_dir: str | None = None,
    cache_dir: str | None = None,
    yfinance_cache_dir: str | None = None,
) -> None:
    """Apply pydantic settings to env before path helpers are first called."""
    if runtime_dir:
        os.environ.setdefault(ENV_RUNTIME_DIR, runtime_dir)
    if cache_dir:
        os.environ.setdefault(ENV_CACHE_DIR, cache_dir)
    if yfinance_cache_dir:
        os.environ.setdefault(ENV_YFINANCE_CACHE_DIR, yfinance_cache_dir)

    get_runtime_root.cache_clear()
