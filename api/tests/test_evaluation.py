import pytest

from evaluation import evaluate_predictions, promotion_gates


def _truth():
    return [
        {"sample_id": "1", "subject_id": "a", "label": "happy", "slices": {"light": "good"}},
        {"sample_id": "2", "subject_id": "b", "label": "sad", "slices": {"light": "low"}},
        {"sample_id": "3", "subject_id": "c", "label": "neutral", "slices": {"light": "good"}},
    ]


def test_abstencao_reduz_cobertura_e_conta_como_erro_total():
    predictions = [
        {
            "sample_id": "1",
            "predicted_label": "happy",
            "signal_status": "ready",
            "signal_confidence": 0.9,
            "distribution": {"happy": 0.9},
            "latency_ms": 50,
        },
        {
            "sample_id": "2",
            "predicted_label": "unknown",
            "signal_status": "insufficient_quality",
            "quality_reasons": ["too_dark"],
            "latency_ms": 20,
        },
        {
            "sample_id": "3",
            "predicted_label": "neutral",
            "signal_status": "ready",
            "signal_confidence": 0.8,
            "distribution": {"neutral": 0.8},
            "latency_ms": 70,
        },
    ]

    report = evaluate_predictions(_truth(), predictions)

    assert report["coverage"] == pytest.approx(2 / 3, abs=1e-6)
    assert report["accuracy"] == pytest.approx(2 / 3, abs=1e-6)
    assert report["confusion_matrix"]["sad"]["unknown"] == 1
    assert report["quality_reason_counts"]["too_dark"] == 1
    assert report["latency_ms"]["p95"] == 68.0


def test_predicao_ausente_vira_unknown():
    report = evaluate_predictions(_truth(), [])
    assert report["coverage"] == 0.0
    assert report["signal_status_counts"]["missing_prediction"] == 3


def test_gates_reprovam_scorecard_sem_evidencia_suficiente():
    report = evaluate_predictions(_truth(), [])
    gates = promotion_gates(report)
    assert gates["passed"] is False
    assert gates["checks"]["coverage"]["passed"] is False
