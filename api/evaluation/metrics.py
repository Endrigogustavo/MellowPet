"""Metricas do scorecard V2 sem dependencia de frameworks de ML.

As funcoes operam sobre manifestos e predicoes JSON-like para que o mesmo
relatorio possa comparar o baseline Python, um modelo ONNX quantizado e a
implementacao nativa capturada em aparelhos reais.
"""
from __future__ import annotations

import math
from collections import Counter, defaultdict
from typing import Iterable, Mapping, Sequence


EXPRESSION_LABELS = (
    "neutral",
    "happy",
    "sad",
    "angry",
    "surprised",
    "disgusted",
    "fearful",
)
UNKNOWN = "unknown"


def _safe_div(numerator: float, denominator: float) -> float:
    return numerator / denominator if denominator else 0.0


def _percentile(values: Sequence[float], percentile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(float(value) for value in values)
    position = (len(ordered) - 1) * percentile
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return round(ordered[lower], 3)
    fraction = position - lower
    return round(
        ordered[lower] * (1.0 - fraction) + ordered[upper] * fraction,
        3,
    )


def _prediction_label(prediction: Mapping) -> str:
    status = str(prediction.get("signal_status", "ready"))
    label = str(prediction.get("predicted_label", UNKNOWN))
    if status != "ready" or label not in EXPRESSION_LABELS:
        return UNKNOWN
    return label


def _confidence(prediction: Mapping, predicted_label: str) -> float:
    value = prediction.get("signal_confidence")
    if value is None:
        value = dict(prediction.get("distribution") or {}).get(predicted_label, 0.0)
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return 0.0


def _class_metrics(
    pairs: Sequence[tuple[str, str]],
) -> tuple[dict[str, dict[str, float | int]], float, float]:
    metrics: dict[str, dict[str, float | int]] = {}
    f1_values: list[float] = []
    recalls: list[float] = []
    for label in EXPRESSION_LABELS:
        true_positive = sum(1 for truth, pred in pairs if truth == label and pred == label)
        false_positive = sum(1 for truth, pred in pairs if truth != label and pred == label)
        false_negative = sum(1 for truth, pred in pairs if truth == label and pred != label)
        support = sum(1 for truth, _pred in pairs if truth == label)
        precision = _safe_div(true_positive, true_positive + false_positive)
        recall = _safe_div(true_positive, true_positive + false_negative)
        f1 = _safe_div(2.0 * precision * recall, precision + recall)
        metrics[label] = {
            "precision": round(precision, 6),
            "recall": round(recall, 6),
            "f1": round(f1, 6),
            "support": support,
        }
        if support:
            f1_values.append(f1)
            recalls.append(recall)
    macro_f1 = _safe_div(sum(f1_values), len(f1_values))
    balanced_accuracy = _safe_div(sum(recalls), len(recalls))
    return metrics, macro_f1, balanced_accuracy


def _calibration_metrics(
    rows: Sequence[tuple[str, str, Mapping]],
    bins: int = 10,
) -> tuple[float | None, float | None, float | None]:
    accepted = [row for row in rows if row[1] != UNKNOWN]
    if not accepted:
        return None, None, None

    buckets: list[list[tuple[float, float]]] = [[] for _ in range(bins)]
    brier_total = 0.0
    confident_errors = 0
    for truth, predicted, prediction in accepted:
        confidence = _confidence(prediction, predicted)
        correct = 1.0 if truth == predicted else 0.0
        bucket_index = min(bins - 1, int(confidence * bins))
        buckets[bucket_index].append((confidence, correct))
        if not correct and confidence >= 0.80:
            confident_errors += 1

        distribution = dict(prediction.get("distribution") or {})
        for label in EXPRESSION_LABELS:
            try:
                probability = max(0.0, min(1.0, float(distribution.get(label, 0.0))))
            except (TypeError, ValueError):
                probability = 0.0
            target = 1.0 if label == truth else 0.0
            brier_total += (probability - target) ** 2

    ece = 0.0
    for bucket in buckets:
        if not bucket:
            continue
        mean_confidence = sum(item[0] for item in bucket) / len(bucket)
        mean_accuracy = sum(item[1] for item in bucket) / len(bucket)
        ece += (len(bucket) / len(accepted)) * abs(mean_accuracy - mean_confidence)

    return (
        round(ece, 6),
        round(brier_total / len(accepted), 6),
        round(confident_errors / len(accepted), 6),
    )


def _evaluate_core(rows: Sequence[tuple[Mapping, Mapping]]) -> dict:
    labeled_rows: list[tuple[str, str, Mapping]] = []
    status_counts: Counter[str] = Counter()
    quality_reason_counts: Counter[str] = Counter()
    latencies: list[float] = []

    for truth, prediction in rows:
        truth_label = str(truth["label"])
        predicted_label = _prediction_label(prediction)
        labeled_rows.append((truth_label, predicted_label, prediction))
        status_counts[str(prediction.get("signal_status", "ready"))] += 1
        quality_reason_counts.update(prediction.get("quality_reasons") or [])
        try:
            latencies.append(float(prediction["latency_ms"]))
        except (KeyError, TypeError, ValueError):
            pass

    pairs = [(truth, prediction) for truth, prediction, _row in labeled_rows]
    accepted_pairs = [pair for pair in pairs if pair[1] != UNKNOWN]
    class_metrics, macro_f1, balanced_accuracy = _class_metrics(pairs)
    selective_metrics, selective_macro_f1, _selective_balanced = _class_metrics(
        accepted_pairs
    )
    ece, brier, confident_error_rate = _calibration_metrics(labeled_rows)
    total = len(rows)
    accepted = len(accepted_pairs)

    confusion: dict[str, dict[str, int]] = {
        label: {candidate: 0 for candidate in (*EXPRESSION_LABELS, UNKNOWN)}
        for label in EXPRESSION_LABELS
    }
    for truth, prediction in pairs:
        confusion[truth][prediction] += 1

    return {
        "samples": total,
        "accepted_samples": accepted,
        "coverage": round(_safe_div(accepted, total), 6),
        "accuracy": round(
            _safe_div(sum(1 for truth, pred in pairs if truth == pred), total),
            6,
        ),
        "macro_f1": round(macro_f1, 6),
        "balanced_accuracy": round(balanced_accuracy, 6),
        "selective_macro_f1": round(selective_macro_f1, 6),
        "per_class": class_metrics,
        "selective_per_class": selective_metrics,
        "ece": ece,
        "brier_score": brier,
        "confident_error_rate": confident_error_rate,
        "latency_ms": {
            "p50": _percentile(latencies, 0.50),
            "p95": _percentile(latencies, 0.95),
            "samples": len(latencies),
        },
        "signal_status_counts": dict(sorted(status_counts.items())),
        "quality_reason_counts": dict(sorted(quality_reason_counts.items())),
        "confusion_matrix": confusion,
    }

def evaluate_predictions(
    manifest: Iterable[Mapping],
    predictions: Iterable[Mapping],
) -> dict:
    """Avalia predicoes unidas ao manifesto por ``sample_id``."""
    truth_rows = [dict(row) for row in manifest]
    by_id = {str(row["sample_id"]): dict(row) for row in predictions}
    rows: list[tuple[Mapping, Mapping]] = []
    subjects: set[str] = set()
    for truth in truth_rows:
        label = str(truth.get("label"))
        if label not in EXPRESSION_LABELS:
            raise ValueError(f"Rotulo de referencia invalido: {label!r}")
        sample_id = str(truth["sample_id"])
        prediction = by_id.get(
            sample_id,
            {
                "sample_id": sample_id,
                "predicted_label": UNKNOWN,
                "signal_status": "missing_prediction",
            },
        )
        rows.append((truth, prediction))
        subjects.add(str(truth.get("subject_id", "unknown")))

    report = _evaluate_core(rows)
    report["subjects"] = len(subjects)

    slice_groups: dict[str, list[tuple[Mapping, Mapping]]] = defaultdict(list)
    for truth, prediction in rows:
        for name, value in dict(truth.get("slices") or {}).items():
            slice_groups[f"{name}={value}"].append((truth, prediction))
    report["slices"] = {
        name: {
            key: value
            for key, value in _evaluate_core(group).items()
            if key in {"samples", "coverage", "macro_f1", "balanced_accuracy"}
        }
        for name, group in sorted(slice_groups.items())
    }
    return report


def promotion_gates(candidate: Mapping, baseline: Mapping | None = None) -> dict:
    """Aplica os gates aprovados na spec e devolve evidencias por criterio."""
    checks: dict[str, dict[str, float | bool | None]] = {}

    def add(name: str, actual, target, passed: bool) -> None:
        checks[name] = {"actual": actual, "target": target, "passed": passed}

    macro_f1 = float(candidate.get("macro_f1", 0.0))
    coverage = float(candidate.get("coverage", 0.0))
    selective = float(candidate.get("selective_macro_f1", 0.0))
    ece = candidate.get("ece")
    confident_error = candidate.get("confident_error_rate")
    latency_p95 = dict(candidate.get("latency_ms") or {}).get("p95")

    add("selective_macro_f1", selective, 0.78, selective >= 0.78)
    add("coverage", coverage, 0.70, coverage >= 0.70)
    add("ece", ece, 0.08, ece is not None and float(ece) <= 0.08)
    add(
        "confident_error_rate",
        confident_error,
        0.05,
        confident_error is not None and float(confident_error) <= 0.05,
    )
    add(
        "latency_p95_ms",
        latency_p95,
        150.0,
        latency_p95 is not None and float(latency_p95) <= 150.0,
    )

    if baseline is not None:
        delta = macro_f1 - float(baseline.get("macro_f1", 0.0))
        add("macro_f1_delta", round(delta, 6), 0.05, delta >= 0.05)
        baseline_per_class = dict(baseline.get("per_class") or {})
        candidate_per_class = dict(candidate.get("per_class") or {})
        worst_recall_delta = min(
            (
                float(candidate_per_class.get(label, {}).get("recall", 0.0))
                - float(baseline_per_class.get(label, {}).get("recall", 0.0))
                for label in EXPRESSION_LABELS
                if int(baseline_per_class.get(label, {}).get("support", 0)) > 0
            ),
            default=0.0,
        )
        add(
            "worst_class_recall_delta",
            round(worst_recall_delta, 6),
            -0.03,
            worst_recall_delta >= -0.03,
        )

    slice_values = [
        float(row.get("macro_f1", 0.0))
        for row in dict(candidate.get("slices") or {}).values()
        if int(row.get("samples", 0)) > 0
    ]
    slice_gap = max(slice_values) - min(slice_values) if len(slice_values) >= 2 else 0.0
    add("critical_slice_gap", round(slice_gap, 6), 0.10, slice_gap <= 0.10)

    return {
        "passed": bool(checks) and all(bool(check["passed"]) for check in checks.values()),
        "checks": checks,
    }
