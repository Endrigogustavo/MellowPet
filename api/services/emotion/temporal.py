"""
Estado temporal por sessao: calibracao, votacao, suavizacao e sequencias.

Um frame isolado e um sinal ruidoso. O que transforma isso em leitura estavel
sao quatro mecanismos, todos dependentes de historico e por isso reunidos aqui:

  1. Calibracao — aprende o rosto em repouso da pessoa nos primeiros frames e
     subtrai esse baseline. Sem isso, quem tem a boca naturalmente curvada para
     baixo aparece triste o tempo todo.
  2. Votacao    — media dos ultimos N frames, para um frame ruim nao virar uma
     troca de emocao.
  3. Suavizacao — media exponencial com histerese, para a emocao exibida nao
     piscar entre duas opcoes empatadas.
  4. Sequencias — quanto tempo a emocao atual persiste, que e o gatilho dos
     alertas.

Tudo vive em memoria e por sessao; sessoes inativas expiram. A calibracao que
precisa sobreviver entre sessoes fica em calibration.py, que persiste no banco.
"""
from __future__ import annotations

import collections
import time
from typing import Optional

from utils.logger import setup_logger

from .constants import BASELINE_FRACTION, CALIBRATION_FRAMES, VOTE_WINDOW
from .mapping import derive_variant
from .models import ActionUnits, EmotionResult, MicroExpression, SessionTemporalState
from .util import clip01, normalize_scores

logger = setup_logger(__name__)


class TemporalTracker:
    """Guarda e evolui o estado temporal de cada sessao."""
    def __init__(self):
        self._sessions: dict[str, SessionTemporalState] = {}
        self._fallback_prev_scores: dict[str, dict[str, float]] = {}

    # ── Ciclo de vida da sessao ─────────────────────────────────────────────

    def get_or_create(self, session_id: str) -> SessionTemporalState:
        state = self._sessions.get(session_id)
        if state is None:
            state = SessionTemporalState(updated_at=time.time())
            self._sessions[session_id] = state
        return state

    def get(self, session_id: Optional[str]) -> Optional[SessionTemporalState]:
        return self._sessions.get(session_id) if session_id else None

    @property
    def active_sessions(self) -> int:
        return len(self._sessions)

    def cleanup_expired(self, now_ts: Optional[float] = None) -> int:
        """Remove sessoes expiradas e devolve quantas sairam."""
        before = len(self._sessions)
        self._cleanup_old_sessions(now_ts if now_ts is not None else time.time())
        return before - len(self._sessions)

    def _cleanup_old_sessions(self, now_ts: float):
        if len(self._sessions) <= 128:
            if len(self._fallback_prev_scores) <= 128:
                return
        stale_keys = [
            key for key, state in self._sessions.items()
            if now_ts - state.updated_at > 20 * 60
        ]
        for key in stale_keys:
            self._sessions.pop(key, None)
            self._fallback_prev_scores.pop(key, None)

        if len(self._fallback_prev_scores) > 128:
            for key in list(self._fallback_prev_scores.keys())[:32]:
                if key not in self._sessions:
                    self._fallback_prev_scores.pop(key, None)

    def update_calibration(self, au: 'ActionUnits', session_id: str) -> None:
        """Accumulate AU data from early frames to establish resting-face baseline."""
        state = self._sessions.get(session_id)
        if state is None or state.calibration_done:
            return

        au_dict = {
            "a12": au.au12_lip_corner_pull, "a6": au.au6_cheek_raise,
            "a4": au.au4_brow_lowerer, "a1": au.au1_inner_brow_raise,
            "a15": au.au15_lip_corner_depress, "a9": au.au9_nose_wrinkle,
            "a20": au.au20_lip_stretch, "a25": au.au25_lips_part,
            "a43": au.au43_eyes_closed,
            # Extended AUs
            "eye_wide": (au.eye_wide_left + au.eye_wide_right) / 2.0,
            "eye_squint": (au.eye_squint_left + au.eye_squint_right) / 2.0,
            "mouth_pucker": au.mouth_pucker,
            "mouth_press": (au.mouth_press_left + au.mouth_press_right) / 2.0,
            "cheek_puff": au.cheek_puff,
            "mouth_dimple": (au.mouth_dimple_left + au.mouth_dimple_right) / 2.0,
            "mouth_roll": (au.mouth_roll_lower + au.mouth_roll_upper) / 2.0,
            "mouth_shrug": (au.mouth_shrug_lower + au.mouth_shrug_upper) / 2.0,
            "mouth_lower_down": au.mouth_lower_down,
            "mouth_upper_up": au.mouth_upper_up,
            "mouth_lateral": (au.mouth_left + au.mouth_right) / 2.0,
        }
        state.calibration_au_buffer.append(au_dict)

        if len(state.calibration_au_buffer) >= CALIBRATION_FRAMES:
            # Compute median per AU as resting baseline
            baseline = {}
            for key in au_dict:
                vals = [snap[key] for snap in state.calibration_au_buffer]
                vals.sort()
                mid = len(vals) // 2
                baseline[key] = vals[mid]
            state.neutral_baseline = baseline
            state.calibration_done = True
            logger.info("calibration done | session=%s baseline=%s", session_id,
                        {k: round(v, 3) for k, v in baseline.items()})

    def subtract_baseline(self, au: 'ActionUnits', session_id: str) -> 'ActionUnits':
        """Subtract a fraction of the resting-face baseline from current AUs."""
        state = self._sessions.get(session_id)
        if state is None or state.neutral_baseline is None:
            return au
        b = state.neutral_baseline
        f = BASELINE_FRACTION
        # Original AUs
        au.au12_lip_corner_pull = max(0.0, au.au12_lip_corner_pull - b.get("a12", 0.0) * f)
        au.au6_cheek_raise = max(0.0, au.au6_cheek_raise - b.get("a6", 0.0) * f)
        au.au4_brow_lowerer = max(0.0, au.au4_brow_lowerer - b.get("a4", 0.0) * f)
        au.au1_inner_brow_raise = max(0.0, au.au1_inner_brow_raise - b.get("a1", 0.0) * f)
        au.au15_lip_corner_depress = max(0.0, au.au15_lip_corner_depress - b.get("a15", 0.0) * f)
        au.au9_nose_wrinkle = max(0.0, au.au9_nose_wrinkle - b.get("a9", 0.0) * f)
        au.au20_lip_stretch = max(0.0, au.au20_lip_stretch - b.get("a20", 0.0) * f)
        au.au25_lips_part = max(0.0, au.au25_lips_part - b.get("a25", 0.0) * f)
        au.au43_eyes_closed = max(0.0, au.au43_eyes_closed - b.get("a43", 0.0) * f)
        # Extended AUs
        ew = b.get("eye_wide", 0.0) * f
        au.eye_wide_left = max(0.0, au.eye_wide_left - ew)
        au.eye_wide_right = max(0.0, au.eye_wide_right - ew)
        es = b.get("eye_squint", 0.0) * f
        au.eye_squint_left = max(0.0, au.eye_squint_left - es)
        au.eye_squint_right = max(0.0, au.eye_squint_right - es)
        au.mouth_pucker = max(0.0, au.mouth_pucker - b.get("mouth_pucker", 0.0) * f)
        mp = b.get("mouth_press", 0.0) * f
        au.mouth_press_left = max(0.0, au.mouth_press_left - mp)
        au.mouth_press_right = max(0.0, au.mouth_press_right - mp)
        au.cheek_puff = max(0.0, au.cheek_puff - b.get("cheek_puff", 0.0) * f)
        md = b.get("mouth_dimple", 0.0) * f
        au.mouth_dimple_left = max(0.0, au.mouth_dimple_left - md)
        au.mouth_dimple_right = max(0.0, au.mouth_dimple_right - md)
        mr = b.get("mouth_roll", 0.0) * f
        au.mouth_roll_lower = max(0.0, au.mouth_roll_lower - mr)
        au.mouth_roll_upper = max(0.0, au.mouth_roll_upper - mr)
        ms = b.get("mouth_shrug", 0.0) * f
        au.mouth_shrug_lower = max(0.0, au.mouth_shrug_lower - ms)
        au.mouth_shrug_upper = max(0.0, au.mouth_shrug_upper - ms)
        # New extra blendshapes
        au.mouth_lower_down = max(0.0, au.mouth_lower_down - b.get("mouth_lower_down", 0.0) * f)
        au.mouth_upper_up = max(0.0, au.mouth_upper_up - b.get("mouth_upper_up", 0.0) * f)
        ml = b.get("mouth_lateral", 0.0) * f
        au.mouth_left = max(0.0, au.mouth_left - ml)
        au.mouth_right = max(0.0, au.mouth_right - ml)
        return au

    def multi_frame_vote(self, scores: dict[str, float], session_id: str) -> dict[str, float]:
        """Average emotion scores over the last N frames for noise reduction."""
        state = self._sessions.get(session_id)
        if state is None:
            return scores
        state.frame_vote_buffer.append(dict(scores))
        if len(state.frame_vote_buffer) > VOTE_WINDOW:
            state.frame_vote_buffer = state.frame_vote_buffer[-VOTE_WINDOW:]
        if len(state.frame_vote_buffer) < 2:
            return scores
        # Weighted average: more recent frames have higher weight
        all_keys = set()
        for s in state.frame_vote_buffer:
            all_keys.update(s.keys())
        n = len(state.frame_vote_buffer)
        weights = [(i + 1) for i in range(n)]  # 1, 2, 3, ...
        tw = sum(weights)
        averaged = {}
        for key in all_keys:
            averaged[key] = sum(w * s.get(key, 0.0) for w, s in zip(weights, state.frame_vote_buffer)) / tw
        return normalize_scores(averaged)

    def detect_micro_expressions(
        self, au: ActionUnits, session_id: Optional[str], now_ts: float
    ) -> list[MicroExpression]:
        """Detect fleeting micro-expressions using 27 AU channels.

        Micro-expressions last 40-500ms and are involuntary facial movements
        that reveal concealed emotions. We track rapid AU deltas across frames
        and use extended blendshapes for higher sensitivity.
        """
        if not session_id:
            return []

        state = self._sessions.get(session_id)
        if state is None:
            return []

        # Comprehensive AU snapshot with extended channels
        au_snapshot = {
            "ts": now_ts,
            "au12": au.au12_lip_corner_pull,
            "au15": au.au15_lip_corner_depress,
            "au4": au.au4_brow_lowerer,
            "au1": au.au1_inner_brow_raise,
            "au2": au.au2_outer_brow_raise,
            "au6": au.au6_cheek_raise,
            "au9": au.au9_nose_wrinkle,
            "au25": au.au25_lips_part,
            "au26": au.au26_jaw_drop,
            "au20": au.au20_lip_stretch,
            "au43": au.au43_eyes_closed,
            # Extended channels
            "eye_wide": (au.eye_wide_left + au.eye_wide_right) / 2.0,
            "eye_squint": (au.eye_squint_left + au.eye_squint_right) / 2.0,
            "mouth_pucker": au.mouth_pucker,
            "mouth_press": (au.mouth_press_left + au.mouth_press_right) / 2.0,
            "mouth_dimple": (au.mouth_dimple_left + au.mouth_dimple_right) / 2.0,
            "mouth_roll": (au.mouth_roll_lower + au.mouth_roll_upper) / 2.0,
            "cheek_puff": au.cheek_puff,
        }
        state.recent_au_snapshots.append(au_snapshot)

        if len(state.recent_au_snapshots) > 15:
            state.recent_au_snapshots = state.recent_au_snapshots[-15:]

        micro_exprs = []
        if len(state.recent_au_snapshots) < 3:
            return micro_exprs

        # Compare current vs 2-frames-ago and 1-frame-ago for velocity detection
        prev2 = state.recent_au_snapshots[-3]
        prev1 = state.recent_au_snapshots[-2]
        curr = state.recent_au_snapshots[-1]
        dt_ms = (curr["ts"] - prev2["ts"]) * 1000.0

        if dt_ms > 3000:
            return micro_exprs

        def delta(key: str) -> float:
            return curr[key] - prev2[key]

        def velocity(key: str) -> float:
            """AU velocity: how fast is it changing (rise then fall = micro-expr)."""
            rise = prev1[key] - prev2[key]
            fall = curr[key] - prev1[key]
            if rise > 0.08 and fall < -0.03:
                return rise  # peaked and started falling = micro-expression
            return 0.0

        # Micro-smile (suppressed happiness): smile spike + quick fade
        smile_vel = velocity("au12")
        smile_delta = delta("au12")
        if smile_vel > 0.12 or (smile_delta > 0.15 and curr["au12"] < 0.5):
            intensity = max(smile_vel, smile_delta)
            # Stronger if dimples also fired
            if delta("mouth_dimple") > 0.05:
                intensity *= 1.2
            micro_exprs.append(MicroExpression(
                emotion="happy", intensity=round(min(1.0, intensity), 3),
                duration_ms=round(dt_ms, 1), timestamp=now_ts,
            ))

        # Micro-frown (suppressed anger/sadness)
        frown_vel = velocity("au4")
        frown_delta = delta("au4")
        if frown_vel > 0.10 or (frown_delta > 0.15 and curr["au4"] < 0.5):
            intensity = max(frown_vel, frown_delta)
            # Anger if nose wrinkle or mouth press co-occur
            is_anger = curr["au9"] > 0.2 or curr["mouth_press"] > 0.15
            micro_exprs.append(MicroExpression(
                emotion="angry" if is_anger else "sad",
                intensity=round(min(1.0, intensity), 3),
                duration_ms=round(dt_ms, 1), timestamp=now_ts,
            ))

        # Micro-surprise: rapid eye widening + brow raise
        eye_wide_delta = delta("eye_wide")
        brow_delta = (delta("au1") + delta("au2")) / 2.0
        if (eye_wide_delta > 0.12 and brow_delta > 0.10) or brow_delta > 0.20:
            intensity = (eye_wide_delta + brow_delta) / 2.0
            micro_exprs.append(MicroExpression(
                emotion="surprised", intensity=round(min(1.0, intensity), 3),
                duration_ms=round(dt_ms, 1), timestamp=now_ts,
            ))

        # Micro-fear: eye wide + brow furrow (AU4) co-occurring
        if eye_wide_delta > 0.10 and delta("au4") > 0.08:
            intensity = (eye_wide_delta + delta("au4")) / 2.0
            micro_exprs.append(MicroExpression(
                emotion="fearful", intensity=round(min(1.0, intensity), 3),
                duration_ms=round(dt_ms, 1), timestamp=now_ts,
            ))

        # Micro-disgust: nose wrinkle spike + lip curl or pucker
        disgust_delta = delta("au9")
        pucker_delta = delta("mouth_pucker")
        if disgust_delta > 0.15 or (disgust_delta > 0.10 and pucker_delta > 0.08):
            intensity = disgust_delta + 0.3 * pucker_delta
            micro_exprs.append(MicroExpression(
                emotion="disgusted", intensity=round(min(1.0, intensity), 3),
                duration_ms=round(dt_ms, 1), timestamp=now_ts,
            ))

        # Micro-contempt: asymmetric smile (one-sided lip pull)
        smile_asym = abs(au.au12_lip_corner_pull - au.mouth_dimple_left)
        if smile_asym > 0.15 and curr["au12"] > 0.1:
            micro_exprs.append(MicroExpression(
                emotion="disgusted",  # contempt mapped to disgust family
                intensity=round(min(1.0, smile_asym), 3),
                duration_ms=round(dt_ms, 1), timestamp=now_ts,
            ))

        state.micro_expressions_detected.extend(micro_exprs)
        if len(state.micro_expressions_detected) > 50:
            state.micro_expressions_detected = state.micro_expressions_detected[-50:]

        return micro_exprs

    def apply_smoothing(self, result: EmotionResult, session_id: Optional[str]) -> EmotionResult:
        """Temporal EMA + hysteresis per session to reduce flicker and false positives."""
        if not session_id or not result.face_detected or not result.all_scores:
            return result

        now_ts = time.time()
        self._cleanup_old_sessions(now_ts)

        state = self._sessions.get(session_id)
        if state is None:
            # First frame for this session — accept it as-is
            state = SessionTemporalState(
                scores_ema=dict(result.all_scores),
                last_emotion=result.emotion,
                updated_at=now_ts,
            )
            self._sessions[session_id] = state
            return result

        # Very responsive EMA: alpha=0.88 makes current frame dominant
        # to avoid ghost of previous emotion lingering in the scores.
        alpha = 0.88 if result.confidence >= 0.50 else 0.75
        smoothed_scores: dict[str, float] = {}
        keys = set(state.scores_ema.keys()) | set(result.all_scores.keys())
        for key in keys:
            prev = state.scores_ema.get(key, 0.0)
            cur = result.all_scores.get(key, 0.0)
            smoothed_scores[key] = (1.0 - alpha) * prev + alpha * cur
        smoothed_scores = normalize_scores(smoothed_scores)

        ranking = sorted(smoothed_scores.items(), key=lambda kv: kv[1], reverse=True)
        candidate = ranking[0][0]
        candidate_score = ranking[0][1]
        secondary = ranking[1][0] if len(ranking) > 1 else None
        secondary_score = ranking[1][1] if len(ranking) > 1 else 0.0
        gap = max(0.0, candidate_score - secondary_score)

        chosen = state.last_emotion
        if candidate != state.last_emotion:
            if state.pending_emotion == candidate:
                state.pending_count += 1
            else:
                state.pending_emotion = candidate
                state.pending_count = 1

            # Immediate switch when the new emotion has any meaningful lead.
            # No pending needed — the EMA already provides smoothing.
            immediate_switch = gap >= 0.04
            confirmed_switch = state.pending_count >= 2 and gap >= 0.015

            if immediate_switch or confirmed_switch:
                logger.info("emotion switch | %s -> %s (gap=%.3f conf=%.3f pending=%d)",
                    state.last_emotion, candidate, gap, result.confidence, state.pending_count,
                )
                chosen = candidate
                state.last_emotion = candidate
                state.pending_emotion = None
                state.pending_count = 0
            else:
                logger.debug("emotion switch pending | %s -> %s (gap=%.3f conf=%.3f pending=%d)",
                    state.last_emotion, candidate, gap, result.confidence, state.pending_count,
                )
        else:
            state.pending_emotion = None
            state.pending_count = 0

        confidence = clip01((result.confidence * 0.50) + (candidate_score * 0.50))

        # Force neutral for very weak signals only
        if chosen != "neutral" and confidence < 0.10:
            chosen = "neutral"
            state.last_emotion = "neutral"
            variant, zone, tip = derive_variant(chosen, confidence, secondary)

        state.scores_ema = smoothed_scores
        state.updated_at = now_ts

        result.emotion = chosen
        result.confidence = round(confidence, 3)
        result.all_scores = {k: round(v, 3) for k, v in smoothed_scores.items()}
        result.secondary_emotion = secondary
        result.emotion_variant = variant
        result.emotion_zone = zone
        result.support_tip = tip
        return result

    def update_streak(self, state: SessionTemporalState, emotion: str, now_ts: float) -> float:
        """Update emotion streak and transitions. Returns streak duration in seconds."""
        if emotion != state.current_streak_emotion:
            # Record transition
            state.emotion_transitions.append({
                "from": state.current_streak_emotion,
                "to": emotion,
                "timestamp": now_ts,
                "duration_seconds": round(now_ts - state.current_streak_start, 1),
            })
            if len(state.emotion_transitions) > 20:
                state.emotion_transitions = state.emotion_transitions[-20:]
            state.current_streak_emotion = emotion
            state.current_streak_start = now_ts
            return 0.0
        return round(now_ts - state.current_streak_start, 1)
