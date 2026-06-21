"""Run: python -m scripts.run_scan (from backend directory)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.strategy.scanner import scanner


def main() -> None:
    print("=" * 60)
    print("  US Technical Trade Scanner")
    print("=" * 60)

    summary = scanner.scan_universe()

    print(
        f"\nScanned: {summary.total_scanned} tickers in {summary.scan_duration_sec}s"
    )
    print(
        f"Signals: {summary.signals_found} "
        f"(Entry Ready: {summary.entry_ready_count}, "
        f"Wait: {summary.wait_count})\n"
    )

    labels = {
        "ENTRY_READY": "ENTRY READY",
        "WAIT": "WAIT",
        "AVOID": "AVOID",
    }

    for result in summary.results:
        badge = labels.get(result.verdict.value, result.verdict.value)
        print(f"{badge}  {result.ticker}  Score: {result.score}%")
        print(f"   {result.verdict_reason}")
        if result.trade_plan:
            p = result.trade_plan
            print(
                f"   Entry: ${p.entry}  T1: ${p.target_1}  T2: ${p.target_2}  "
                f"SL: ${p.stop_loss}  R:R 1:{p.reward_risk}"
            )
        print(
            f"   RSI: {result.rsi14}  Vol: {result.volume_ratio}x  "
            f"Trend: {result.overview.trend.value}"
        )
        print()


if __name__ == "__main__":
    main()
