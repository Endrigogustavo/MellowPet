"""
Helpers numericos compartilhados pelo motor de emocao."""
def clip01(value: float) -> float:
    """
    Prende um valor no intervalo [0, 1]."""
    return max(0.0, min(1.0, float(value)))


def normalize_scores(scores: dict[str, float]) -> dict[str, float]:
    """Normaliza as pontuacoes para somarem 1.

    Valores negativos sao zerados antes da soma; se tudo zerar, devolve o
    dicionario original em vez de dividir por zero.
    """
    total = sum(max(0.0, v) for v in scores.values()) or 1.0
    return {k: max(0.0, v) / total for k, v in scores.items()}
