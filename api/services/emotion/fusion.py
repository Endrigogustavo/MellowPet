"""
Fusao do ensemble e calculo de confianca."""
from typing import Optional

from .util import clip01, normalize_scores


def ensemble_fusion(
    cnn_scores: Optional[dict[str, float]],
    landmark_scores: Optional[dict[str, float]],
    extra_scores: Optional[dict[str, float]] = None,
    weights: Optional[tuple[float, float, float]] = None,
) -> dict[str, float]:
    """Combina, com pesos, as saidas dos detectores disponiveis.

    `weights` permite ao orquestrador ponderar por qualidade do rosto: quando a
    cabeca esta girada os blendshapes degradam mais que a CNN, e o peso migra
    para ela. Sem `weights`, usa os pesos fixos historicos.

    Sinais ausentes (None) sao ignorados e os pesos renormalizados, de modo que
    o resultado continue somando 1 com qualquer subconjunto de detectores.
    """
    candidates = (cnn_scores, landmark_scores, extra_scores)
    default_weights = (0.55, 0.45, 0.15)
    chosen = weights or default_weights

    score_sets: list[dict[str, float]] = []
    active_weights: list[float] = []
    for scores, weight in zip(candidates, chosen):
        if scores and weight > 0:
            score_sets.append(scores)
            active_weights.append(weight)

    if not score_sets:
        return {"neutral": 1.0}

    weights = active_weights

    # Normalize weights to sum to 1
    total_weight = sum(weights)
    weights = [w / total_weight for w in weights]

    all_keys = set()
    for s in score_sets:
        all_keys.update(s.keys())

    fused = {}
    for key in all_keys:
        fused[key] = sum(
            w * s.get(key, 0.0)
            for w, s in zip(weights, score_sets)
        )

    return normalize_scores(fused)

def compute_ensemble_confidence(primary: str,
    primary_score: float,
    gap: float,
    deepface_scores: Optional[dict],
    facemesh_scores: Optional[dict],
    opencv_scores: Optional[dict],
) -> float:
    """
    Compute confidence based on model agreement and score dominance."""
    base_conf = 0.30 + primary_score * 0.50 + gap * 0.30

    # Agreement bonus: if multiple models agree on the primary emotion
    agreement_count = 0
    total_models = 0

    for scores in [deepface_scores, facemesh_scores, opencv_scores]:
        if scores:
            total_models += 1
            model_top = max(scores, key=scores.get)
            if model_top == primary:
                agreement_count += 1

    if total_models > 1:
        agreement_ratio = agreement_count / total_models
        base_conf += agreement_ratio * 0.18

    # Penalize neutral slightly so real emotions can surface
    if primary == "neutral":
        base_conf *= 0.90

    return clip01(base_conf)
