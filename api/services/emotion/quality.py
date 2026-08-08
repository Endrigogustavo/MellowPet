"""Metricas de qualidade do frame/rosto."""
from typing import Optional

import cv2
import numpy as np

from .models import ActionUnits
from .util import clip01


def compute_face_quality(frame: np.ndarray, au: Optional[ActionUnits]) -> dict:
    """Return real-time face quality metrics to guide the user."""
    gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
    h, w = gray.shape[:2]

    brightness = float(np.mean(gray)) / 255.0
    contrast = float(np.std(gray)) / 128.0
    sharpness = min(1.0, float(cv2.Laplacian(gray, cv2.CV_64F).var()) / 200.0)

    # Lighting assessment
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

    # Overall quality score
    quality_score = clip01(
        brightness * 0.2 + contrast * 0.25 + sharpness * 0.35
        + (0.2 if angle == "frontal" else 0.05)
    )

    # Guidance tips
    tips = []
    if lighting == "too_dark":
        tips.append("Aumente a iluminação do ambiente")
    elif lighting == "too_bright":
        tips.append("Reduza a luz direta no rosto")
    elif lighting == "flat":
        tips.append("Melhore o contraste de iluminação")
    if sharpness < 0.3:
        tips.append("Mantenha o celular estável")
    if angle != "frontal":
        tips.append("Olhe diretamente para a câmera")

    return {
        "lighting": lighting,
        "sharpness": round(sharpness, 2),
        "brightness": round(brightness, 2),
        "contrast": round(contrast, 2),
        "face_angle": angle,
        "quality_score": round(quality_score, 2),
        "tips": tips,
    }
