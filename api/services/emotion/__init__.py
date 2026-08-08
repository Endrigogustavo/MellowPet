"""
Motor de deteccao de emocao da MellowPet.

Ponto de entrada publico do pacote. O resto do codigo deve importar daqui e nao
dos submodulos, para que a organizacao interna possa mudar sem quebrar quem usa:

    from services.emotion import emotion_service, NEGATIVE_EMOTIONS

    result = await emotion_service.analyze_frame_base64(frame_b64, session_id)

Organizacao interna (leia nesta ordem para entender o pipeline):

    service.py      orquestrador — amarra tudo, comece por aqui
    landmarker.py   MediaPipe: frame -> landmarks, blendshapes, Action Units
    fer_onnx.py     CNN FER+ em ONNX Runtime sobre o recorte do rosto
    mapping.py      Action Units -> pontuacao de emocao
    fusion.py       combina os dois sinais e calcula a confianca
    temporal.py     calibracao, votacao, suavizacao e sequencias por sessao
    calibration.py  baseline por usuario, persistido entre sessoes
    vitals.py       batimento cardiaco por rPPG
    quality.py      metricas de qualidade do rosto
    frames.py       decodificacao e realce do frame
    models.py       dataclasses compartilhadas
    constants.py    rotulos, indices de landmark e conteudo
    assets.py       download e verificacao dos modelos
"""
from typing import TYPE_CHECKING

from .constants import (
    EMOTION_MAP,
    EMOTION_MESSAGES,
    MUSIC_SUGGESTIONS,
    NEGATIVE_EMOTIONS,
    POSITIVE_EMOTIONS,
)
from .models import ActionUnits, EmotionResult, MicroExpression, SessionTemporalState

if TYPE_CHECKING:  # pragma: no cover
    from .service import EmotionDetectionService

_service = None


def __getattr__(name: str):
    """Instancia o servico apenas quando alguem pedir por ele (PEP 562).

    Carregar os modelos custa ~40 MB e alguns segundos. Fazer isso no import do
    pacote significaria pagar esse preco em qualquer `from services.emotion
    import ...` — inclusive nos testes que so querem as constantes, e em
    ferramentas que so leem os dataclasses. Com isto, quem importa
    `emotion_service` paga; os demais, nao.
    """
    global _service
    if name == "emotion_service":
        if _service is None:
            from .service import EmotionDetectionService

            _service = EmotionDetectionService()
        return _service
    if name == "EmotionDetectionService":
        from .service import EmotionDetectionService

        return EmotionDetectionService
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

__all__ = [
    "emotion_service",
    "EmotionDetectionService",
    "EmotionResult",
    "ActionUnits",
    "MicroExpression",
    "SessionTemporalState",
    "EMOTION_MAP",
    "EMOTION_MESSAGES",
    "MUSIC_SUGGESTIONS",
    "NEGATIVE_EMOTIONS",
    "POSITIVE_EMOTIONS",
]
