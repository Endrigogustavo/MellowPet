"""
Orquestrador da deteccao de emocao.

Este e o unico modulo que conhece todos os outros; os demais nao se conhecem
entre si. Ler este arquivo de cima a baixo deve explicar o pipeline inteiro:

    frame
      -> landmarker    (landmarks, blendshapes, Action Units, bounding box)
      -> calibracao    (subtrai o rosto em repouso da pessoa)
      -> mapping       (Action Units -> pontuacao de emocao)
      -> FER ONNX      (CNN treinada, sobre o recorte do rosto)
      -> fusao         (combina os dois sinais, ponderando por qualidade)
      -> vitals        (batimento por rPPG ajusta ansiedade/raiva)
      -> temporal      (votacao, suavizacao, sequencia)
      -> EmotionResult

Duas escolhas de precisao valem destaque:

  - Os dois sinais sao independentes por construcao. O FER olha textura de
    pixels; os blendshapes olham geometria. Quando concordam, a confianca sobe
    de verdade; quando divergem, e sinal de frame ruim e a confianca cai.
  - O peso da fusao acompanha a qualidade medida do rosto. Rosto girado degrada
    blendshape mais do que degrada a CNN, entao o peso migra para o FER.
"""
from __future__ import annotations

import random
import time
from typing import Optional

import numpy as np

from utils.logger import setup_logger

from . import calibration as calib
from .constants import EMOTION_MESSAGES, MUSIC_SUGGESTIONS
from .fer_onnx import FerOnnxClassifier
from .frames import decode_frame, enhance_frame
from .fusion import compute_ensemble_confidence, ensemble_fusion
from .landmarker import FaceLandmarkerEngine
from .mapping import (
    classify_intensity,
    detect_compound_emotion,
    derive_variant,
    au_to_emotion_scores,
    post_fusion_corrections,
)
from .models import ActionUnits, EmotionResult
from .quality import compute_face_quality
from .temporal import TemporalTracker
from .util import clip01, normalize_scores
from .vitals import compute_heart_rate, extract_rppg_signal, hr_emotion_adjustment

logger = setup_logger(__name__)

# Assimetria acima disto sugere expressao forcada; suprime um pouco as emocoes
# nao neutras. Rostos genuinamente expressivos sao simetricos.
_ASYMMETRY_THRESHOLD = 0.30

# Amostras de rPPG mantidas por sessao (a ~1 fps, 60 = 1 minuto).
_RPPG_MAX_SAMPLES = 60

# Micro-expressao que concorda com a emocao principal reforca a confianca.
_MICRO_AGREEMENT_BONUS = 0.05


class EmotionDetectionService:
    """Fachada do motor de emocao. Instancia unica por processo."""
    def __init__(self):
        self.landmarker = FaceLandmarkerEngine()
        self.fer = FerOnnxClassifier()
        self.tracker = TemporalTracker()
        # Baselines de usuario carregados do banco, em cache por sessao.
        self._session_user: dict[str, str] = {}
        self._loaded_baselines: set[str] = set()

        if not self.landmarker.available and not self.fer.available:
            logger.error("Nenhum detector disponivel — instale mediapipe e onnxruntime. ""A analise vai responder sempre face_detected=false.")
        else:
            logger.info("Motor de emocao pronto | landmarks=%s fer_onnx=%s",
                self.landmarker.available,
                self.fer.available,
            )

    # ── Pesos da fusao ──────────────────────────────────────────────────────

    @staticmethod
    def _fusion_weights(face_quality: float, has_blendshapes: bool) -> tuple[float, float]:
        """Pesos (fer, landmarks) conforme a qualidade do rosto.

        Rosto frontal e nitido: os blendshapes sao muito informativos e pesam
        mais. Conforme a cabeca gira, o blendshape degrada mais rapido que a
        CNN, entao o peso migra para o FER.
        """
        if not has_blendshapes:
            return 1.0, 0.0
        landmark_weight = 0.35 + 0.30 * clip01(face_quality)
        return 1.0 - landmark_weight, landmark_weight

    # ── Pipeline ────────────────────────────────────────────────────────────

    def detect_from_frame(
        self,
        frame: np.ndarray,
        session_id: Optional[str] = None,
    ) -> EmotionResult:
        """Roda o pipeline completo num frame BGR."""
        started = time.perf_counter()

        observation = self.landmarker.detect(frame)

        # O FER precisa de um recorte do rosto. Sem landmarks nao ha caixa
        # confiavel, e classificar o frame inteiro produz ruido — melhor
        # declarar que nao houve rosto do que adivinhar.
        if observation is None:
            return self._no_face_result(started)

        au_raw = observation.action_units
        models_used: list[str] = ["face_landmarker"]

        # ── Calibracao: desconta o rosto em repouso ──────────────────────────
        au = au_raw
        if session_id:
            self.tracker.update_calibration(au_raw, session_id)
            au = self.tracker.subtract_baseline(au_raw, session_id)

        # ── Sinal 1: geometria (Action Units -> emocao) ──────────────────────
        landmark_scores = au_to_emotion_scores(au)

        if observation.asymmetry > _ASYMMETRY_THRESHOLD:
            landmark_scores = self._suppress_asymmetric(
                landmark_scores, observation.asymmetry
            )

        # ── Sinal 2: CNN sobre o recorte do rosto ───────────────────────────
        fer_scores = None
        if self.fer.available:
            fer_scores = self.fer.predict(frame, observation.face_box)
            if fer_scores:
                models_used.append("fer_onnx")

        # ── Fusao ───────────────────────────────────────────────────────────
        fer_weight, landmark_weight = self._fusion_weights(
            au.face_quality, bool(observation.blendshapes)
        )
        fused = ensemble_fusion(
            fer_scores,
            landmark_scores,
            None,
            weights=(fer_weight, landmark_weight, 0.0),
        )
        fused = post_fusion_corrections(fused, au)

        # ── Batimento cardiaco (rPPG) ───────────────────────────────────────
        hr_bpm, hr_confidence, hr_status = self._update_vitals(
            frame, observation.landmarks, session_id
        )
        if hr_bpm is not None:
            fused = hr_emotion_adjustment(fused, hr_bpm, hr_confidence)

        # ── Votacao temporal ────────────────────────────────────────────────
        if session_id:
            fused = self.tracker.multi_frame_vote(fused, session_id)

        micro_expressions = self.tracker.detect_micro_expressions(
            au, session_id, time.time()
        )

        return self._build_result(
            fused=fused,
            au=au,
            observation=observation,
            fer_scores=fer_scores,
            landmark_scores=landmark_scores,
            micro_expressions=micro_expressions,
            models_used=models_used,
            frame=frame,
            hr=(hr_bpm, hr_confidence, hr_status),
            started=started,
        )

    # ── Passos auxiliares ───────────────────────────────────────────────────

    @staticmethod
    def _suppress_asymmetric(scores: dict[str, float], asymmetry: float) -> dict[str, float]:
        """Reduz emocoes nao neutras quando a expressao e muito assimetrica."""
        suppression = min(0.15, (asymmetry - _ASYMMETRY_THRESHOLD) * 0.5)
        adjusted = {
            emotion: (value if emotion == "neutral" else max(0.0, value - suppression))
            for emotion, value in scores.items()
        }
        return normalize_scores(adjusted)

    def _update_vitals(
        self,
        frame: np.ndarray,
        landmarks,
        session_id: Optional[str],
    ) -> tuple[Optional[float], float, str]:
        """Acumula o sinal de rPPG e estima o batimento."""
        if not session_id or landmarks is None:
            return None, 0.0, "collecting"

        state = self.tracker.get_or_create(session_id)
        green = extract_rppg_signal(frame, landmarks)
        if green is not None:
            state.rppg_timestamps.append(time.time())
            state.rppg_green_means.append(green)
            if len(state.rppg_timestamps) > _RPPG_MAX_SAMPLES:
                state.rppg_timestamps = state.rppg_timestamps[-_RPPG_MAX_SAMPLES:]
                state.rppg_green_means = state.rppg_green_means[-_RPPG_MAX_SAMPLES:]

        return compute_heart_rate(state)

    def _build_result(
        self,
        *,
        fused: dict[str, float],
        au: ActionUnits,
        observation,
        fer_scores: Optional[dict[str, float]],
        landmark_scores: Optional[dict[str, float]],
        micro_expressions: list,
        models_used: list[str],
        frame: np.ndarray,
        hr: tuple[Optional[float], float, str],
        started: float,
    ) -> EmotionResult:
        ranking = sorted(fused.items(), key=lambda kv: kv[1], reverse=True)
        primary, primary_score = ranking[0]
        secondary, secondary_score = (ranking[1] if len(ranking) > 1 else (None, 0.0))
        gap = max(0.0, primary_score - secondary_score)

        confidence = compute_ensemble_confidence(
            primary, primary_score, gap, fer_scores, landmark_scores, None
        )

        # Micro-expressao no mesmo sentido da emocao principal e evidencia
        # independente; vale um reforco pequeno.
        if any(m.emotion == primary for m in micro_expressions):
            confidence = clip01(confidence + _MICRO_AGREEMENT_BONUS)

        variant, zone, tip = derive_variant(primary, confidence, secondary)
        hr_bpm, hr_confidence, hr_status = hr

        return EmotionResult(
            emotion=primary,
            confidence=round(confidence, 3),
            all_scores={k: round(v, 3) for k, v in fused.items()},
            emotion_variant=variant,
            emotion_zone=zone,
            support_tip=tip,
            secondary_emotion=secondary,
            face_detected=True,
            processing_time_ms=round((time.perf_counter() - started) * 1000, 1),
            music_suggestions=MUSIC_SUGGESTIONS.get(primary, []),
            action_units=self._au_summary(au),
            micro_expressions=[
                {"emotion": m.emotion, "intensity": m.intensity, "duration_ms": m.duration_ms}
                for m in micro_expressions
            ],
            detection_models_used=models_used,
            face_mesh_landmarks_count=observation.landmark_count,
            compound_emotion=detect_compound_emotion(fused),
            emotion_intensity=classify_intensity(confidence, au),
            face_quality_metrics=compute_face_quality(frame, au),
            heart_rate_bpm=hr_bpm,
            heart_rate_confidence=round(hr_confidence, 3),
            heart_rate_status=hr_status,
        )

    @staticmethod
    def _au_summary(au: Optional[ActionUnits]) -> Optional[dict]:
        """Action Units expostos na resposta da API."""
        if au is None:
            return None
        names = ("au1_inner_brow_raise",
            "au2_outer_brow_raise",
            "au4_brow_lowerer",
            "au6_cheek_raise",
            "au9_nose_wrinkle",
            "au12_lip_corner_pull",
            "au15_lip_corner_depress",
            "au20_lip_stretch",
            "au25_lips_part",
            "au26_jaw_drop",
            "au43_eyes_closed",
        )
        return {name: round(getattr(au, name, 0.0), 3) for name in names}

    @staticmethod
    def _no_face_result(started: float) -> EmotionResult:
        """Resposta quando nenhum rosto foi localizado.

        Devolve face_detected=False em vez de chutar uma emocao. A versao
        anterior caia numa heuristica de Haar cascade que produzia pontuacoes
        de baixa qualidade — poluia o historico com leituras inventadas.
        """
        return EmotionResult(
            emotion="neutral",
            confidence=0.0,
            all_scores={},
            face_detected=False,
            processing_time_ms=round((time.perf_counter() - started) * 1000, 1),
            detection_models_used=[],
        )

    # ── Entrada assincrona ──────────────────────────────────────────────────

    async def analyze_frame_base64(
        self,
        frame_b64: str,
        session_id: Optional[str] = None,
        pet_name: str = "Mellow",
        user_id: Optional[str] = None,
    ) -> EmotionResult:
        """Decodifica o frame, roda o pipeline e aplica a suavizacao temporal."""
        frame = decode_frame(frame_b64)
        if frame is None:
            logger.warning("Frame invalido recebido (len=%d)", len(frame_b64))
            return EmotionResult(
                emotion="neutral",
                confidence=0.0,
                all_scores={},
                face_detected=False,
                processing_time_ms=0.0,
            )

        # Semeia a calibracao com o baseline salvo do usuario, uma vez por
        # sessao — assim os primeiros frames ja saem calibrados.
        if session_id and user_id:
            await self._seed_user_baseline(session_id, user_id)

        result = self.detect_from_frame(frame, session_id)
        result = self.tracker.apply_smoothing(result, session_id)

        if session_id:
            self._record_history(result, session_id)

        messages = EMOTION_MESSAGES.get(result.emotion, EMOTION_MESSAGES["neutral"])
        result.message = random.choice(messages).replace("{pet_name}", pet_name)

        logger.info("emocao analisada | emotion=%s confidence=%.3f face=%s ms=%.1f modelos=%s micro=%d",
            result.emotion,
            result.confidence,
            result.face_detected,
            result.processing_time_ms,
            "+".join(result.detection_models_used) or "nenhum",
            len(result.micro_expressions),
        )
        return result

    async def _seed_user_baseline(self, session_id: str, user_id: str) -> None:
        """Carrega o baseline salvo do usuario para dentro do estado da sessao."""
        if session_id in self._loaded_baselines:
            return
        self._loaded_baselines.add(session_id)
        self._session_user[session_id] = user_id

        baseline = await calib.load_baseline(user_id)
        if baseline is None or not baseline.is_trustworthy:
            return

        state = self.tracker.get_or_create(session_id)
        # `neutral_baseline` e exatamente o formato que subtract_baseline espera,
        # e `calibration_done` evita reaprender do zero nesta sessao.
        state.neutral_baseline = dict(baseline.values)
        state.calibration_done = True
        logger.info("Calibracao de %s aplicada (aprendida em %d sessoes)",
            user_id,
            baseline.sessions_observed,
        )

    async def persist_user_baseline(self, session_id: str) -> None:
        """Salva o baseline aprendido nesta sessao. Chamado ao encerrar."""
        user_id = self._session_user.get(session_id)
        state = self.tracker.get(session_id)
        if not user_id or state is None or not state.neutral_baseline:
            return
        await calib.save_baseline(user_id, state.neutral_baseline)

    def _record_history(self, result: EmotionResult, session_id: str) -> None:
        """Guarda o historico curto da sessao e atualiza a sequencia."""
        state = self.tracker.get(session_id)
        if state is None:
            return

        state.emotion_history.append({
            "emotion": result.emotion,
            "confidence": result.confidence,
            "timestamp": result.timestamp,
        })
        if len(state.emotion_history) > 60:
            state.emotion_history = state.emotion_history[-60:]

        result.emotion_streak_seconds = self.tracker.update_streak(
            state, result.emotion, time.time()
        )
