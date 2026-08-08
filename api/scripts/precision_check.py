"""
Confere o comportamento da suavizacao temporal com sequencias sinteticas.

Nao mede precisao de deteccao — mede se a maquina de estados evita os dois
defeitos classicos: trocar de emocao por causa de um frame ruim, e ficar
piscando entre duas emocoes empatadas.

Uso:
    cd api && python -m scripts.precision_check
"""
from services.emotion.models import EmotionResult
from services.emotion.temporal import TemporalTracker

SESSION = "session_test_precision"
def apply_case(
    tracker: TemporalTracker,
    raw_emotion: str,
    confidence: float,
    scores: dict[str, float],
    idx: int,
) -> EmotionResult:
    result = EmotionResult(
        emotion=raw_emotion,
        confidence=confidence,
        all_scores=scores,
        face_detected=True,
    )
    smoothed = tracker.apply_smoothing(result, SESSION)
    top = sorted(smoothed.all_scores.items(), key=lambda item: item[1], reverse=True)[:3]
    print(
        f"frame={idx:02d} bruto={raw_emotion:9s} conf={confidence:.3f} "f"-> escolhido={smoothed.emotion:9s} conf_saida={smoothed.confidence:.3f} topo={top}")
    return smoothed


def run_case(title: str, expectation: str, frames: list[tuple[str, float, dict]]) -> None:
    print(f"\n[{title}] {expectation}\n")
    tracker = TemporalTracker()
    tracker.get_or_create(SESSION)
    for idx, (emotion, confidence, scores) in enumerate(frames, start=1):
        apply_case(tracker, emotion, confidence, scores, idx)


if __name__ == "__main__":
    run_case("CASO A",
        "ansiedade fraca e ambigua: neutral deve persistir",
        [("anxious", 0.26, {"anxious": 0.28, "neutral": 0.27, "happy": 0.23, "sad": 0.22})] * 6,
    )

    run_case("CASO B",
        "alegria forte e consistente: deve assumir happy",
        [("happy", 0.82, {"happy": 0.80, "neutral": 0.10, "sad": 0.05, "angry": 0.05})] * 6,
    )

    run_case("CASO C",
        "um frame ruim no meio: nao deve trocar de emocao",
        [("happy", 0.80, {"happy": 0.78, "neutral": 0.12, "sad": 0.10})] * 3
        + [("angry", 0.55, {"angry": 0.52, "happy": 0.30, "neutral": 0.18})]
        + [("happy", 0.80, {"happy": 0.78, "neutral": 0.12, "sad": 0.10})] * 3,
    )

    run_case("CASO D",
        "empate alternando: nao deve piscar entre as duas",
        [
            ("happy", 0.50, {"happy": 0.50, "sad": 0.48, "neutral": 0.02}),
            ("sad", 0.50, {"sad": 0.50, "happy": 0.48, "neutral": 0.02}),
        ] * 4,
    )
