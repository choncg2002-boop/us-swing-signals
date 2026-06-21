import json
import threading
from pathlib import Path

from app.core.paths import get_runtime_root
from app.portfolio.models import PortfolioState

_lock = threading.Lock()
_FILENAME = "portfolio.json"


def _path() -> Path:
    return get_runtime_root() / _FILENAME


def load_state() -> PortfolioState:
    path = _path()
    with _lock:
        if not path.exists():
            return PortfolioState()
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return PortfolioState.model_validate(data)
        except (json.JSONDecodeError, ValueError):
            return PortfolioState()


def save_state(state: PortfolioState) -> None:
    path = _path()
    with _lock:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(state.model_dump_json(indent=2), encoding="utf-8")
