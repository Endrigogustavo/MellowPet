"""Estruturas de dados da deteccao de emocao.

Sao dataclasses puras, sem dependencia de modelo ou de IO — servem de contrato
entre os modulos do motor (landmarks, fusao, temporal, vitals).
"""
import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ActionUnits:
    """Facial Action Unit estimates from Face Mesh landmarks (0.0–1.0)."""
    au1_inner_brow_raise: float = 0.0   # Inner brow raise
    au2_outer_brow_raise: float = 0.0   # Outer brow raise
    au4_brow_lowerer: float = 0.0       # Brow furrowing
    au6_cheek_raise: float = 0.0        # Cheek raise (Duchenne)
    au9_nose_wrinkle: float = 0.0       # Nose wrinkle
    au12_lip_corner_pull: float = 0.0   # Smile
    au15_lip_corner_depress: float = 0.0 # Frown
    au20_lip_stretch: float = 0.0       # Lip stretch
    au25_lips_part: float = 0.0         # Lips part (jaw open)
    au26_jaw_drop: float = 0.0          # Jaw drop
    au43_eyes_closed: float = 0.0       # Eye closure
    head_tilt_x: float = 0.0            # Pitch
    head_tilt_y: float = 0.0            # Yaw
    face_quality: float = 0.0           # Overall face visibility quality
    # Extended blendshapes for precision
    eye_wide_left: float = 0.0          # Eye widening (surprise/fear)
    eye_wide_right: float = 0.0
    eye_squint_left: float = 0.0        # Eye squint (happy/disgust)
    eye_squint_right: float = 0.0
    mouth_pucker: float = 0.0           # Lip pucker (disgust/contempt)
    mouth_press_left: float = 0.0       # Lip press (anger/contempt)
    mouth_press_right: float = 0.0
    cheek_puff: float = 0.0             # Cheek puff
    jaw_left: float = 0.0               # Jaw lateral
    jaw_right: float = 0.0
    mouth_dimple_left: float = 0.0      # Dimple (smirk/contempt)
    mouth_dimple_right: float = 0.0
    mouth_roll_lower: float = 0.0       # Lip roll (anxiety, thinking)
    mouth_roll_upper: float = 0.0
    mouth_shrug_lower: float = 0.0      # Mouth shrug (doubt)
    mouth_shrug_upper: float = 0.0
    # Extra blendshapes for improved precision
    mouth_lower_down: float = 0.0       # Lower lip pulled down (disgust/sad)
    mouth_upper_up: float = 0.0         # Upper lip raise (disgust snarl)
    mouth_left: float = 0.0             # Mouth shifted left (asymmetric disgust)
    mouth_right: float = 0.0            # Mouth shifted right
    brow_inner_up: float = 0.0          # Raw browInnerUp (redundant w/ au1 but useful)


@dataclass
class MicroExpression:
    """A fleeting expression detected in <500ms window."""
    emotion: str
    intensity: float
    duration_ms: float
    timestamp: float


@dataclass
class EmotionResult:
    emotion: str
    confidence: float
    all_scores: dict
    emotion_variant: str = "steady"
    emotion_zone: str = "balanced"
    support_tip: str = "Respire com calma e siga em pequenos passos."
    secondary_emotion: Optional[str] = None
    face_detected: bool = True
    processing_time_ms: float = 0.0
    message: Optional[str] = None
    music_suggestions: list = field(default_factory=list)
    timestamp: float = field(default_factory=time.time)
    action_units: Optional[dict] = None
    micro_expressions: list = field(default_factory=list)
    detection_models_used: list = field(default_factory=list)
    face_mesh_landmarks_count: int = 0
    # New: compound emotions, intensity, quality, streak
    compound_emotion: Optional[str] = None
    emotion_intensity: str = "mild"  # calm/mild/moderate/intense/extreme
    face_quality_metrics: Optional[dict] = None  # lighting, sharpness, angle, distance
    emotion_streak_seconds: float = 0.0
    # rPPG heart rate estimation
    heart_rate_bpm: Optional[float] = None         # Estimated BPM (None = not enough data yet)
    heart_rate_confidence: float = 0.0             # 0.0–1.0 signal reliability
    heart_rate_status: str = "collecting"  # collecting / ready / unstable
    # Contrato semantico V2, tambem exposto no endpoint legado durante a
    # migracao. "unknown" e abstencao; nunca deve virar neutral por fallback.
    signal_status: str = "ready"
    quality_reasons: list[str] = field(default_factory=list)
    tension_signal: Optional[float] = None
    pipeline_version: str = "legacy-server-p0"
    calibration_progress: Optional[float] = None

    def __post_init__(self):
        try:
            self.confidence = float(self.confidence)
        except Exception:
            self.confidence = 0.0

        try:
            self.processing_time_ms = float(self.processing_time_ms)
        except Exception:
            self.processing_time_ms = 0.0

        try:
            self.timestamp = float(self.timestamp)
        except Exception:
            self.timestamp = time.time()

        if self.all_scores is None:
            self.all_scores = {}
        else:
            cleaned: dict[str, float] = {}
            for k, v in dict(self.all_scores).items():
                try:
                    cleaned[str(k)] = float(v)
                except Exception:
                    continue
            self.all_scores = cleaned


@dataclass
class SessionTemporalState:
    scores_ema: dict[str, float] = field(default_factory=dict)
    last_emotion: str = "neutral"
    pending_emotion: Optional[str] = None
    pending_count: int = 0
    updated_at: float = field(default_factory=time.time)
    # Micro-expression tracking
    recent_au_snapshots: list = field(default_factory=list)  # last N AU readings
    micro_expressions_detected: list = field(default_factory=list)
    # Enhanced history for pattern tracking
    emotion_history: list = field(default_factory=list)  # last 30 readings
    # Streak tracking
    current_streak_emotion: str = "neutral"
    current_streak_start: float = field(default_factory=time.time)
    emotion_transitions: list = field(default_factory=list)  # last 20 transitions
    # rPPG heart rate tracking
    rppg_timestamps: list = field(default_factory=list)    # float timestamps
    rppg_green_means: list = field(default_factory=list)   # green channel averages
    rppg_last_bpm: Optional[float] = None
    rppg_last_confidence: float = 0.0
    # Adaptive neutral calibration: learn resting-face AU baseline from first N frames
    calibration_au_buffer: list = field(default_factory=list)  # list of AU dicts
    calibration_done: bool = False
    neutral_baseline: Optional[dict] = None  # median AU values for resting face
    # Multi-frame voting window for robust decisions
    frame_vote_buffer: list = field(default_factory=list)  # last N emotion scores
