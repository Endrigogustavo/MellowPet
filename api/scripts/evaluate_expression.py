"""Gera scorecard JSON a partir de manifesto e predicoes JSONL.

Uso:
    python -m scripts.evaluate_expression \
      --manifest evaluation/manifest.example.jsonl \
      --predictions evaluation/predictions.example.jsonl \
      --output evaluation/reports/smoke-scorecard.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from evaluation import evaluate_predictions, promotion_gates


def _read_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise ValueError(f"JSON invalido em {path}:{line_number}: {exc}") from exc
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Avalia o motor de expressoes V2")
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--predictions", type=Path, required=True)
    parser.add_argument("--baseline", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    report = evaluate_predictions(
        _read_jsonl(args.manifest),
        _read_jsonl(args.predictions),
    )
    baseline = None
    if args.baseline:
        baseline = json.loads(args.baseline.read_text(encoding="utf-8"))
    report["promotion"] = promotion_gates(report, baseline)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"scorecard={args.output}")
    print(
        "samples={samples} coverage={coverage:.3f} macro_f1={macro_f1:.3f} "
        "selective_macro_f1={selective_macro_f1:.3f}".format(**report)
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
