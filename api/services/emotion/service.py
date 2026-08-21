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

import asyncio
import random
import time
from typing import Optional

import numpy as np

from utils.logger import setup_logger

from . import calibration as calib
from .constants import CALIBRATION_FRAMES, EMOTION_MESSAGES, MUSIC_SUGGESTIONS
from .fer_onnx import FerOnnxClassifier
from .frames import decode_frame
from .fusion import compute_ensemble_confidence, ensemble_fusion
from .landmarker import FaceLandmarkerEngine
from .mapping import (
    classify_intensity,
    detect_compound_emotion,
    derive_variant,
    au_to_emotion_scores,
    compute_tension_signal,
    post_fusion_corrections,
)
from .models import ActionUnits, EmotionResult
from .quality import compute_face_quality
from .temporal import TemporalTracker
from .util import clip01, normalize_scores

logger = setup_logger(__name__)

# Assimetria acima disto sugere expressao forcada; suprime um pouco as emocoes
# nao neutras. Rostos genuinamente expressivos sao simetricos.
_ASYMMETRY_THRESHOLD = 0.30

class EmotionDetectionService:
    """Fachada do motor de emocao. Instancia unica por processo."""
    def __init__(self):
        self.landmarker = FaceLandmarkerEngine()
        self.fer = FerOnnxClassifier()
        self.tracker = TemporalTracker()
        # Libera o event loop do FastAPI sem introduzir concorrencia insegura
        # nos runtimes nativos do baseline. A V2 local remove o servidor do
        # caminho critico; durante a migracao, uma inferencia roda por vez.
        self._inference_lock = asyncio.Lock()
        # Baselines de usuario carregados do banco, em cache por sessao.
        self._session_user: dict[str, str] = {}
        self._loaded_baselines: set[str] = set()
        self._calibration_sessions: set[str] = set()

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
        calibration_mode: bool = False,
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

        # Qualidade protege todos os estagios posteriores. Um rosto localizado
        # com luz/pose/nitidez ruins e evidencia insuficiente, nao neutralidade.
        quality = compute_face_quality(frame, au_raw, observation.face_box)
        if not quality["accepted"]:
            return self._insufficient_quality_result(
                started, quality, models_used=models_used
            )

        # ── Calibracao: desconta o rosto em repouso ──────────────────────────
        au = au_raw
        if session_id and calibration_mode:
            self.tracker.update_calibration(au_raw, session_id)
            state = self.tracker.get(session_id)
            if state is not None and not state.calibration_done:
                return self._calibration_result(
                    started,
                    quality,
                    models_used=models_used,
                    accepted_samples=len(state.calibration_au_buffer),
                )

        if session_id:
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

        # ── Votacao temporal ────────────────────────────────────────────────
        if session_id:
            fused = self.tracker.multi_frame_vote(fused, session_id)

        return self._build_result(
            fused=fused,
            au=au,
            observation=observation,
            fer_scores=fer_scores,
            landmark_scores=landmark_scores,
            micro_expressions=[],
            models_used=models_used,
            frame=frame,
            quality=quality,
            hr=(None, 0.0, "disabled"),
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
        quality: dict,
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
            face_quality_metrics=quality,
            heart_rate_bpm=hr_bpm,
            heart_rate_confidence=round(hr_confidence, 3),
            heart_rate_status=hr_status,
            signal_status="ready",
            quality_reasons=[],
            tension_signal=round(compute_tension_signal(au), 3),
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
            emotion="unknown",
            confidence=0.0,
            all_scores={},
            face_detected=False,
            processing_time_ms=round((time.perf_counter() - started) * 1000, 1),
            detection_models_used=[],
            signal_status="no_face",
            quality_reasons=[],
        )

    @staticmethod
    def _insufficient_quality_result(
        started: float,
        quality: dict,
        *,
        models_used: list[str],
    ) -> EmotionResult:
        """Abstem quando ha rosto, mas o sinal nao permite classificar."""
        return EmotionResult(
            emotion="unknown",
            confidence=0.0,
            all_scores={},
            face_detected=True,
            processing_time_ms=round((time.perf_counter() - started) * 1000, 1),
            detection_models_used=models_used,
            face_quality_metrics=quality,
            signal_status="insufficient_quality",
            quality_reasons=list(quality.get("reasons", [])),
        )

    @staticmethod
    def _calibration_result(
        started: float,
        quality: dict,
        *,
        models_used: list[str],
        accepted_samples: int,
    ) -> EmotionResult:
        return EmotionResult(
            emotion="unknown",
            confidence=0.0,
            all_scores={},
            face_detected=True,
            processing_time_ms=round((time.perf_counter() - started) * 1000, 1),
            detection_models_used=models_used,
            face_quality_metrics=quality,
            signal_status="warming_up",
            calibration_progress=round(
                min(1.0, accepted_samples / CALIBRATION_FRAMES), 3
            ),
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
                emotion="unknown",
                confidence=0.0,
                all_scores={},
                face_detected=False,
                processing_time_ms=0.0,
                signal_status="insufficient_quality",
                quality_reasons=["invalid_frame"],
            )

        # Semeia a calibracao com o baseline salvo do usuario, uma vez por
        # sessao — assim os primeiros frames ja saem calibrados.
        calibration_mode = bool(
            session_id and session_id in self._calibration_sessions
        )
        if session_id and user_id and not calibration_mode:
            await self._seed_user_baseline(session_id, user_id)

        async with self._inference_lock:
            result = await asyncio.to_thread(
                self.detect_from_frame,
                frame,
                session_id,
                calibration_mode,
            )

        if calibration_mode and session_id:
            state = self.tracker.get(session_id)
            if state is not None and state.calibration_done:
                await self.persist_user_baseline(session_id)
                self._calibration_sessions.discard(session_id)
        result = self.tracker.apply_smoothing(result, session_id)

        if session_id:
            self._record_history(result, session_id)

        messages = EMOTION_MESSAGES.get(result.emotion, EMOTION_MESSAGES["unknown"])
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

    def begin_calibration(self, session_id: str, user_id: str) -> dict:
        """Inicia calibracao voluntaria e descarta qualquer buffer parcial."""
        state = self.tracker.get_or_create(session_id)
        state.calibration_au_buffer = []
        state.neutral_baseline = None
        state.calibration_done = False
        self._session_user[session_id] = user_id
        self._loaded_baselines.add(session_id)
        self._calibration_sessions.add(session_id)
        return self.calibration_status(session_id)

    def cancel_calibration(self, session_id: str) -> dict:
        state = self.tracker.get(session_id)
        if state is not None:
            state.calibration_au_buffer = []
            state.neutral_baseline = None
            state.calibration_done = False
        self._calibration_sessions.discard(session_id)
        return self.calibration_status(session_id)

    def calibration_status(self, session_id: str) -> dict:
        state = self.tracker.get(session_id)
        accepted = len(state.calibration_au_buffer) if state else 0
        return {
            "session_id": session_id,
            "active": session_id in self._calibration_sessions,
            "accepted_samples": accepted,
            "required_samples": CALIBRATION_FRAMES,
            "progress": round(min(1.0, accepted / CALIBRATION_FRAMES), 3),
            "completed": bool(state and state.calibration_done),
        }

    async def persist_user_baseline(self, session_id: str) -> None:
        """Salva o baseline aprendido nesta sessao. Chamado ao encerrar."""
        user_id = self._session_user.get(session_id)
        state = self.tracker.get(session_id)
        if not user_id or state is None or not state.neutral_baseline:
            return
        await calib.save_baseline(user_id, state.neutral_baseline)

    def _record_history(self, result: EmotionResult, session_id: str) -> None:
        """Guarda o historico curto da sessao e atualiza a sequencia."""
        if not result.face_detected or result.emotion == "unknown":
            return
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
