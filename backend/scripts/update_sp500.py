"""Update bundled S&P 500 ticker list from Wikipedia."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.data.universe import _fetch_from_wikipedia, _save_bundle


def main() -> None:
    tickers = _fetch_from_wikipedia()
    _save_bundle(tickers)
    print(f"Saved {len(tickers)} S&P 500 tickers")


if __name__ == "__main__":
    main()
