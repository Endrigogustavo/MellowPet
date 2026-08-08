"""
Helpers geometricos sobre os landmarks do MediaPipe."""
import math

import numpy as np


def compute_asymmetry(blendshape_map: dict) -> float:
    """Compute facial asymmetry score (0=symmetric, 1=very asymmetric).
    Genuine emotions tend to be more symmetric than faked ones."""
    pairs = [
        ("browDownLeft", "browDownRight"),
        ("browOuterUpLeft", "browOuterUpRight"),
        ("cheekSquintLeft", "cheekSquintRight"),
        ("mouthSmileLeft", "mouthSmileRight"),
        ("mouthFrownLeft", "mouthFrownRight"),
        ("eyeSquintLeft", "eyeSquintRight"),
        ("eyeBlinkLeft", "eyeBlinkRight"),
    ]
    diffs = []
    for left_key, right_key in pairs:
        l = blendshape_map.get(left_key, 0.0)
        r = blendshape_map.get(right_key, 0.0)
        if l + r > 0.02:
            diffs.append(abs(l - r) / max(l + r, 0.01))
    if not diffs:
        return 0.0
    return sum(diffs) / len(diffs)

def landmark_distance(lm, idx_a: int, idx_b: int) -> float:
    """
    Euclidean distance between two landmarks."""
    a = lm[idx_a]
    b = lm[idx_b]
    return math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)

def landmark_y_diff(lm, idx_a: int, idx_b: int) -> float:
    """
    Signed Y difference (positive = a is below b)."""
    return lm[idx_a].y - lm[idx_b].y
