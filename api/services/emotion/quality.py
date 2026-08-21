"""Metricas e gate de qualidade do frame/rosto."""
from typing import Optional

import cv2
import numpy as np

from .models import ActionUnits
from .util import clip01


def compute_face_quality(
    frame: np.ndarray,
    au: Optional[ActionUnits],
    face_box: Optional[tuple[int, int, int, int]] = None,
) -> dict:
    """Mede o sinal e decide se ele e confiavel para classificar.

    O decoder do pipeline entrega BGR. Medir o recorte facial, em vez do frame
    inteiro, impede que um fundo claro mas um rosto escuro passe no gate.
    """
    height, width = frame.shape[:2]
    roi = frame
    face_coverage = None
    if face_box is not None:
        x, y, box_width, box_height = face_box
        x0 = max(0, x)
        y0 = max(0, y)
        x1 = min(width, x + box_width)
        y1 = min(height, y + box_height)
        if x1 > x0 and y1 > y0:
            roi = frame[y0:y1, x0:x1]
            face_coverage = ((x1 - x0) * (y1 - y0)) / max(1, width * height)

    if roi.ndim == 3:
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    else:
        gray = roi

    brightness = float(np.mean(gray)) / 255.0
    contrast = float(np.std(gray)) / 128.0
    sharpness = min(1.0, float(cv2.Laplacian(gray, cv2.CV_64F).var()) / 200.0)

    # Avaliacao de luz e pose.
    if brightness < 0.18:
        lighting = "too_dark"
    elif brightness > 0.88:
        lighting = "too_bright"
    elif contrast < 0.25:
        lighting = "flat"
    else:
        lighting = "good"

    # Face angle from head tilt AUs
    angle = "frontal"
    if au is not None:
        if abs(au.head_tilt_y) > 0.35:
            angle = "side_turned"
        elif abs(au.head_tilt_x) > 0.35:
            angle = "tilted"

    # Score continuo para telemetria/fusao e razoes discretas para abstencao.
    quality_score = clip01(
        brightness * 0.2 + contrast * 0.25 + sharpness * 0.35
        + (0.2 if angle == "frontal" else 0.05)
    )

    tips: list[str] = []
    reasons: list[str] = []
    if lighting == "too_dark":
        reasons.append("too_dark")
        tips.append("Aumente a iluminação do ambiente")
    elif lighting == "too_bright":
        reasons.append("overexposed")
        tips.append("Reduza a luz direta no rosto")
    elif lighting == "flat":
        reasons.append("low_contrast")
        tips.append("Melhore o contraste de iluminação")
    if sharpness < 0.3:
        reasons.append("blurred")
        tips.append("Mantenha o celular estável")
    if angle != "frontal":
        reasons.append("pose_out_of_range")
        tips.append("Olhe diretamente para a câmera")
    if face_coverage is not None and face_coverage < 0.08:
        reasons.append("face_too_small")
        tips.append("Aproxime um pouco o rosto da câmera")

    return {
        "lighting": lighting,
        "sharpness": round(sharpness, 2),
        "brightness": round(brightness, 2),
        "contrast": round(contrast, 2),
        "face_angle": angle,
        "face_coverage": round(face_coverage, 3) if face_coverage is not None else None,
        "quality_score": round(quality_score, 2),
        "accepted": not reasons,
        "reasons": reasons,
        "tips": tips,
    }
