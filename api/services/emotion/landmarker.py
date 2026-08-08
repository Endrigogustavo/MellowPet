"""
MediaPipe Face Landmarker: frame -> landmarks, blendshapes e Action Units.

Este modulo so extrai sinal do frame. Nao guarda estado entre chamadas e nao
sabe o que e "sessao" — calibracao, votacao e suavizacao vivem em temporal.py.
Essa separacao e o que permite testar o mapeamento de blendshapes sem subir
modelo nenhum, e trocar o detector sem tocar na logica temporal.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Optional

import cv2
import numpy as np

from utils.logger import setup_logger

from .action_units import compute_action_units
from .assets import FACE_LANDMARKER, ensure_model
from .geometry import compute_asymmetry
from .models import ActionUnits
from .util import clip01

logger = setup_logger(__name__)

# Landmarks usados para estimar a pose da cabeca.
_LM_NOSE_TIP = 1
_LM_LEFT_EYE_OUTER = 33
_LM_RIGHT_EYE_OUTER = 263
_LM_CHIN = 152
_LM_FOREHEAD = 10


@dataclass
class LandmarkObservation:
    """
    O que um frame produziu, antes de qualquer ajuste temporal."""
    action_units: ActionUnits
    landmarks: list
    blendshapes: dict[str, float] = field(default_factory=dict)
    asymmetry: float = 0.0
    face_box: Optional[tuple[int, int, int, int]] = None
    yaw: float = 0.0    # 0 = frontal, 1 = perfil
    pitch: float = 0.0  # 0 = nivelado, 1 = muito inclinado
    landmark_count: int = 0


def blendshapes_to_action_units(blendshapes: dict[str, float]) -> ActionUnits:
    """Converte os 52 blendshapes estilo ARKit em Action Units do FACS.

    Preferimos os blendshapes a geometria de landmark porque eles ja saem
    normalizados pelo formato do rosto da pessoa — uma boca naturalmente larga
    nao vira "sorriso" como aconteceria medindo distancia entre pontos.
    """
    au = ActionUnits()
    if not blendshapes:
        return au

    def bs(name: str) -> float:
        return blendshapes.get(name, 0.0)

    def mean(a: str, b: str) -> float:
        return (bs(a) + bs(b)) / 2.0

    # ── Action Units principais ─────────────────────────────────────────────
    au.au1_inner_brow_raise = clip01(bs("browInnerUp"))
    au.au2_outer_brow_raise = clip01(max(bs("browOuterUpLeft"), bs("browOuterUpRight")))
    au.au4_brow_lowerer = clip01(max(bs("browDownLeft"), bs("browDownRight")))
    au.au6_cheek_raise = clip01(mean("cheekSquintLeft", "cheekSquintRight"))
    au.au9_nose_wrinkle = clip01(bs("noseSneerLeft") + bs("noseSneerRight"))
    au.au12_lip_corner_pull = clip01(mean("mouthSmileLeft", "mouthSmileRight"))
    au.au15_lip_corner_depress = clip01(mean("mouthFrownLeft", "mouthFrownRight"))
    au.au20_lip_stretch = clip01(mean("mouthStretchLeft", "mouthStretchRight"))
    au.au25_lips_part = clip01(max(bs("mouthOpen"), bs("jawOpen") * 0.5))
    au.au26_jaw_drop = clip01(bs("jawOpen"))
    au.au43_eyes_closed = clip01(mean("eyeBlinkLeft", "eyeBlinkRight"))

    # ── Blendshapes extras usados pelo mapeamento fino ──────────────────────
    au.eye_wide_left = clip01(bs("eyeWideLeft"))
    au.eye_wide_right = clip01(bs("eyeWideRight"))
    au.eye_squint_left = clip01(bs("eyeSquintLeft"))
    au.eye_squint_right = clip01(bs("eyeSquintRight"))
    au.mouth_pucker = clip01(bs("mouthPucker"))
    au.mouth_press_left = clip01(bs("mouthPressLeft"))
    au.mouth_press_right = clip01(bs("mouthPressRight"))
    au.cheek_puff = clip01(bs("cheekPuff"))
    au.jaw_left = clip01(bs("jawLeft"))
    au.jaw_right = clip01(bs("jawRight"))
    au.mouth_dimple_left = clip01(bs("mouthDimpleLeft"))
    au.mouth_dimple_right = clip01(bs("mouthDimpleRight"))
    au.mouth_roll_lower = clip01(bs("mouthRollLower"))
    au.mouth_roll_upper = clip01(bs("mouthRollUpper"))
    au.mouth_shrug_lower = clip01(bs("mouthShrugLower"))
    au.mouth_shrug_upper = clip01(bs("mouthShrugUpper"))
    au.mouth_lower_down = clip01(mean("mouthLowerDownLeft", "mouthLowerDownRight"))
    au.mouth_upper_up = clip01(mean("mouthUpperUpLeft", "mouthUpperUpRight"))
    au.mouth_left = clip01(bs("mouthLeft"))
    au.mouth_right = clip01(bs("mouthRight"))
    au.brow_inner_up = clip01(bs("browInnerUp"))

    return au


def estimate_head_pose(landmarks) -> tuple[float, float]:
    """Estima (yaw, pitch) normalizados a partir dos landmarks.

    O codigo anterior lia "headPitch"/"headYaw" dos blendshapes, mas esses
    nomes nao existem entre os 52 do MediaPipe — o valor era sempre 0 e a
    qualidade do rosto ficava presa em 1.0. Aqui a pose e medida de fato, o que
    importa porque blendshape de rosto girado e menos confiavel.

    yaw: assimetria da distancia nariz-canto de cada olho.
    pitch: posicao do nariz entre testa e queixo.
    """
    try:
        nose = landmarks[_LM_NOSE_TIP]
        left = landmarks[_LM_LEFT_EYE_OUTER]
        right = landmarks[_LM_RIGHT_EYE_OUTER]
        chin = landmarks[_LM_CHIN]
        forehead = landmarks[_LM_FOREHEAD]

        d_left = abs(nose.x - left.x)
        d_right = abs(right.x - nose.x)
        total = d_left + d_right
        yaw = abs(d_left - d_right) / total if total > 1e-6 else 0.0

        span = abs(chin.y - forehead.y)
        if span > 1e-6:
            # 0.5 = nariz no meio do rosto (cabeca nivelada).
            relative = (nose.y - forehead.y) / span
            pitch = abs(relative - 0.5) * 2.0
        else:
            pitch = 0.0

        return clip01(yaw), clip01(pitch)
    except Exception:
        return 0.0, 0.0


def landmarks_to_box(landmarks, width: int, height: int) -> Optional[tuple[int, int, int, int]]:
    """Bounding box do rosto em pixels, a partir dos landmarks normalizados.

    Usada para recortar o rosto para o classificador FER. Sai dos landmarks e
    nao do detector porque, quando ha landmarks, eles delimitam o rosto com
    mais precisao — e sem custo extra de inferencia.
    """
    try:
        xs = [lm.x for lm in landmarks]
        ys = [lm.y for lm in landmarks]
        x0 = int(max(0.0, min(xs)) * width)
        x1 = int(min(1.0, max(xs)) * width)
        y0 = int(max(0.0, min(ys)) * height)
        y1 = int(min(1.0, max(ys)) * height)
        if x1 <= x0 or y1 <= y0:
            return None
        return x0, y0, x1 - x0, y1 - y0
    except Exception:
        return None


class FaceLandmarkerEngine:
    """
    Envolve o FaceLandmarker do MediaPipe (478 landmarks + 52 blendshapes)."""
    def __init__(self):
        self._detector = None
        self._mp = None
        self.available = False
        # O detector nativo nao e reentrante entre threads.
        self._lock = threading.Lock()
        self._load()

    def _load(self) -> None:
        try:
            import mediapipe as mp
        except ImportError:
            logger.warning("mediapipe nao instalado — analise de landmarks desligada")
            return

        if not (hasattr(mp, "tasks") and hasattr(mp.tasks, "vision")):
            logger.warning("API Tasks do MediaPipe indisponivel — landmarks desligados")
            return

        try:
            model_path = ensure_model(FACE_LANDMARKER)
            base_options = mp.tasks.BaseOptions(
                model_asset_path=str(model_path),
                delegate=mp.tasks.BaseOptions.Delegate.CPU,
            )
            options = mp.tasks.vision.FaceLandmarkerOptions(
                base_options=base_options,
                running_mode=mp.tasks.vision.RunningMode.IMAGE,
                num_faces=1,
                output_face_blendshapes=True,
            )
            self._detector = mp.tasks.vision.FaceLandmarker.create_from_options(options)
            self._mp = mp
            self.available = True
            logger.info("FaceLandmarker carregado (478 landmarks + 52 blendshapes) [CPU]")
        except Exception as exc:
            logger.warning("Nao foi possivel carregar o FaceLandmarker: %s", exc)

    def detect(self, frame: np.ndarray) -> Optional[LandmarkObservation]:
        """
        Extrai landmarks e Action Units de um frame BGR, ou None sem rosto."""
        if not self.available or self._detector is None or self._mp is None:
            return None

        try:
            results = self._detect_with_rotation(frame)
            if results is None:
                return None

            landmarks = results.face_landmarks[0]
            if len(landmarks) < 468:
                return None

            blendshapes: dict[str, float] = {}
            if results.face_blendshapes:
                blendshapes = {
                    category.category_name: category.score
                    for category in results.face_blendshapes[0]
                }

            if blendshapes:
                au = blendshapes_to_action_units(blendshapes)
                asymmetry = compute_asymmetry(blendshapes)
            else:
                # Sem blendshapes, cai para a geometria dos landmarks.
                au = compute_action_units(landmarks)
                asymmetry = 0.0

            yaw, pitch = estimate_head_pose(landmarks)
            au.head_tilt_x = pitch
            au.head_tilt_y = yaw
            # Rosto girado ou muito inclinado degrada o blendshape; registrar
            # isso deixa a fusao pesar este sinal para baixo.
            au.face_quality = clip01(1.0 - yaw * 1.2 - pitch * 0.5)

            height, width = frame.shape[:2]
            return LandmarkObservation(
                action_units=au,
                landmarks=landmarks,
                blendshapes=blendshapes,
                asymmetry=asymmetry,
                face_box=landmarks_to_box(landmarks, width, height),
                yaw=yaw,
                pitch=pitch,
                landmark_count=len(landmarks),
            )
        except Exception as exc:
            logger.debug("Analise de landmarks falhou: %s", exc)
            return None

    def _detect_with_rotation(self, frame: np.ndarray):
        """Tenta o frame original e, se nao achar rosto, girado 90 graus.

        Rede de seguranca para cameras de celular que enviam o frame sem
        aplicar a rotacao do EXIF.
        """
        mp = self._mp
        for rotation in (None, cv2.ROTATE_90_COUNTERCLOCKWISE):
            image = frame if rotation is None else cv2.rotate(frame, rotation)
            mp_image = mp.Image(
                image_format=mp.ImageFormat.SRGB,
                data=np.ascontiguousarray(image),
            )
            with self._lock:
                results = self._detector.detect(mp_image)
            if results and results.face_landmarks:
                if rotation is not None:
                    logger.debug("Rosto encontrado apos rotacao")
                return results
        return None
