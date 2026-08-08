"""
Calibracao persistente por usuario.

Este e o mecanismo que de fato faz a deteccao melhorar com o uso — e o analogo
honesto de "RAG" para um problema de visao computacional, que nao se resolve
recuperando documentos.

O problema concreto: os Action Units saem de um rosto especifico. Quem tem a
boca naturalmente curvada para baixo marca AU15 (canto do labio abaixado) mesmo
relaxado, e o sistema o le como triste. O `TemporalTracker` ja corrige isso
aprendendo o rosto em repouso — mas so dentro de uma sessao, e joga tudo fora
quando o app reabre.

Aqui o baseline aprendido e guardado por usuario e devolvido pronto na sessao
seguinte, com dois efeitos:

  - a leitura ja comeca calibrada, em vez de errar os primeiros frames;
  - o baseline melhora com o tempo, por media movel sobre varias sessoes.

Nao ha treino de modelo nem gradiente: e uma media movel de valores em repouso.
Chamar de "aprendizado" seria exagero — e calibracao, e resolve a maior fonte de
erro sistematico do pipeline.
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Optional

from utils.database import database, user_calibration
from utils.logger import setup_logger

logger = setup_logger(__name__)

# Peso da nova amostra na media movel. Baixo de proposito: uma sessao ruim
# (usuario de fato triste durante todo o uso) nao deve reescrever o baseline.
LEARNING_RATE = 0.20

# Sessoes minimas antes de confiar no baseline salvo.
MIN_SESSIONS_TO_TRUST = 2


@dataclass
class UserBaseline:
    """Rosto em repouso aprendido de um usuario.

    `values` usa exatamente as chaves que `TemporalTracker.update_calibration`
    produz ("a12", "a6", "eye_wide", ...), para poder ser atribuido direto a
    `SessionTemporalState.neutral_baseline` sem conversao.
    """
    values: dict[str, float] = field(default_factory=dict)
    sessions_observed: int = 0
    updated_at: float = 0.0

    @property
    def is_trustworthy(self) -> bool:
        return self.sessions_observed >= MIN_SESSIONS_TO_TRUST and bool(self.values)


def _blend(previous: dict[str, float], sample: dict[str, float], rate: float) -> dict[str, float]:
    """
    Media movel exponencial campo a campo."""
    merged = dict(previous)
    for name, value in sample.items():
        if name in merged:
            merged[name] = (1.0 - rate) * merged[name] + rate * value
        else:
            merged[name] = value
    return merged


async def load_baseline(user_id: str) -> Optional[UserBaseline]:
    """
    Busca o baseline salvo de um usuario, ou None se nao houver."""
    if not user_id:
        return None
    try:
        row = await database.fetch_one(
            user_calibration.select().where(user_calibration.c.user_id == user_id)
        )
        if row is None:
            return None
        data = dict(row)
        values = json.loads(data.get("baseline_json") or "{}")
        return UserBaseline(
            values={k: float(v) for k, v in values.items()},
            sessions_observed=int(data.get("sessions_observed") or 0),
            updated_at=float(data.get("updated_at_ts") or 0.0),
        )
    except Exception as exc:
        # Calibracao e melhoria, nao requisito: falhar aqui nao pode derrubar
        # a analise do frame.
        logger.warning("Nao foi possivel carregar a calibracao de %s: %s", user_id, exc)
        return None


async def save_baseline(user_id: str, sample: dict[str, float]) -> Optional[UserBaseline]:
    """Mistura o baseline observado ao que ja estava salvo.

    Chamado ao encerrar uma sessao, quando o `TemporalTracker` ja aprendeu o
    rosto em repouso daquela sessao. `sample` e o `neutral_baseline` da sessao.
    """
    if not user_id or not sample:
        return None

    try:
        existing = await load_baseline(user_id)
        if existing and existing.values:
            values = _blend(existing.values, sample, LEARNING_RATE)
            sessions = existing.sessions_observed + 1
        else:
            values = sample
            sessions = 1

        now = time.time()
        payload = {
            "baseline_json": json.dumps({k: round(v, 5) for k, v in values.items()}),
            "sessions_observed": sessions,
            "updated_at_ts": now,
        }

        if existing is None:
            await database.execute(
                user_calibration.insert().values(user_id=user_id, **payload)
            )
        else:
            await database.execute(
                user_calibration.update()
                .where(user_calibration.c.user_id == user_id)
                .values(**payload)
            )

        logger.info("Calibracao de %s atualizada (sessoes=%d campos=%d)",
            user_id,
            sessions,
            len(values),
        )
        return UserBaseline(values=values, sessions_observed=sessions, updated_at=now)
    except Exception as exc:
        logger.warning("Nao foi possivel salvar a calibracao de %s: %s", user_id, exc)
        return None
