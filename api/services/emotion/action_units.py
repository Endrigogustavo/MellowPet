"""
Landmarks faciais -> Action Units (FACS)."""
import math

from .constants import (
    LIP_LEFT, LIP_RIGHT, LIP_TOP, LIP_BOTTOM,
    UPPER_LIP_TOP, LOWER_LIP_BOTTOM, LEFT_EYE_TOP, LEFT_EYE_BOTTOM,
    LEFT_EYE_INNER, LEFT_EYE_OUTER, RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM,
    RIGHT_EYE_INNER, RIGHT_EYE_OUTER, LEFT_BROW_INNER, LEFT_BROW_OUTER,
    LEFT_BROW_MID, RIGHT_BROW_INNER, RIGHT_BROW_OUTER, RIGHT_BROW_MID,
    NOSE_TIP, NOSE_BRIDGE, JAW_LEFT, JAW_RIGHT,
    JAW_BOTTOM, LEFT_CHEEK, RIGHT_CHEEK, FOREHEAD_MID,
)
from .geometry import compute_asymmetry, landmark_distance, landmark_y_diff
from .models import ActionUnits
from .util import clip01


def compute_action_units(landmarks) -> ActionUnits:
    """
    Estimate facial Action Units from 468 Face Mesh landmarks."""
    lm = landmarks
    au = ActionUnits()

    # Reference distances for normalization
    face_height = landmark_distance(lm, FOREHEAD_MID, JAW_BOTTOM)
    face_width = landmark_distance(lm, JAW_LEFT, JAW_RIGHT)
    if face_height < 0.001 or face_width < 0.001:
        return au

    # ── AU1: Inner Brow Raise ─────────────────────────────────────────
    left_inner_brow_lift = landmark_y_diff(lm, NOSE_BRIDGE, LEFT_BROW_INNER)
    right_inner_brow_lift = landmark_y_diff(lm, NOSE_BRIDGE, RIGHT_BROW_INNER)
    avg_inner_brow = (left_inner_brow_lift + right_inner_brow_lift) / 2.0
    au.au1_inner_brow_raise = clip01(avg_inner_brow / face_height * 8.0)

    # ── AU2: Outer Brow Raise ─────────────────────────────────────────
    left_outer_brow_lift = landmark_y_diff(lm, LEFT_EYE_OUTER, LEFT_BROW_OUTER)
    right_outer_brow_lift = landmark_y_diff(lm, RIGHT_EYE_OUTER, RIGHT_BROW_OUTER)
    avg_outer_brow = (left_outer_brow_lift + right_outer_brow_lift) / 2.0
    au.au2_outer_brow_raise = clip01(avg_outer_brow / face_height * 10.0)

    # ── AU4: Brow Lowerer ─────────────────────────────────────────────
    brow_mid_dist = (
        landmark_distance(lm, LEFT_BROW_MID, LEFT_EYE_TOP) +
        landmark_distance(lm, RIGHT_BROW_MID, RIGHT_EYE_TOP)
    ) / 2.0
    brow_closeness = 1.0 - (brow_mid_dist / face_height * 6.0)
    au.au4_brow_lowerer = clip01(brow_closeness)

    # ── AU6: Cheek Raise (Duchenne marker) ───────────────────────────
    left_cheek_rise = landmark_y_diff(lm, LEFT_EYE_BOTTOM, LEFT_CHEEK)
    right_cheek_rise = landmark_y_diff(lm, RIGHT_EYE_BOTTOM, RIGHT_CHEEK)
    cheek_squeeze = (
        landmark_distance(lm, LEFT_EYE_BOTTOM, LEFT_CHEEK) +
        landmark_distance(lm, RIGHT_EYE_BOTTOM, RIGHT_CHEEK)
    ) / 2.0
    au.au6_cheek_raise = clip01(1.0 - cheek_squeeze / face_height * 5.0)

    # ── AU9: Nose Wrinkle ─────────────────────────────────────────────
    nose_bridge_dist = landmark_distance(lm, NOSE_BRIDGE, NOSE_TIP)
    nose_compress = 1.0 - (nose_bridge_dist / face_height * 4.0)
    au.au9_nose_wrinkle = clip01(nose_compress)

    # ── AU12: Lip Corner Pull (Smile) ─────────────────────────────────
    lip_width = landmark_distance(lm, LIP_LEFT, LIP_RIGHT)
    lip_corner_height = -(
        (lm[LIP_LEFT].y + lm[LIP_RIGHT].y) / 2.0 -
        (lm[LIP_TOP].y + lm[LIP_BOTTOM].y) / 2.0
    )
    smile_ratio = lip_width / face_width
    au.au12_lip_corner_pull = clip01(
        (smile_ratio - 0.25) * 3.0 + lip_corner_height / face_height * 8.0
    )

    # ── AU15: Lip Corner Depressor (Frown) ───────────────────────────
    lip_center_y = (lm[LIP_TOP].y + lm[LIP_BOTTOM].y) / 2.0
    lip_corners_y = (lm[LIP_LEFT].y + lm[LIP_RIGHT].y) / 2.0
    frown_signal = (lip_corners_y - lip_center_y) / face_height
    au.au15_lip_corner_depress = clip01(frown_signal * 12.0)

    # ── AU20: Lip Stretch ─────────────────────────────────────────────
    au.au20_lip_stretch = clip01((lip_width / face_width - 0.3) * 4.0)

    # ── AU25: Lips Part ───────────────────────────────────────────────
    lip_opening = landmark_distance(lm, LIP_TOP, LIP_BOTTOM)
    au.au25_lips_part = clip01(lip_opening / face_height * 8.0)

    # ── AU26: Jaw Drop ────────────────────────────────────────────────
    jaw_open = landmark_distance(lm, UPPER_LIP_TOP, LOWER_LIP_BOTTOM)
    au.au26_jaw_drop = clip01(jaw_open / face_height * 4.0)

    # ── AU43: Eyes Closed ─────────────────────────────────────────────
    left_eye_open = landmark_distance(lm, LEFT_EYE_TOP, LEFT_EYE_BOTTOM)
    right_eye_open = landmark_distance(lm, RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM)
    left_eye_width = landmark_distance(lm, LEFT_EYE_INNER, LEFT_EYE_OUTER)
    right_eye_width = landmark_distance(lm, RIGHT_EYE_INNER, RIGHT_EYE_OUTER)
    left_ear = left_eye_open / max(left_eye_width, 0.001)
    right_ear = right_eye_open / max(right_eye_width, 0.001)
    avg_ear = (left_ear + right_ear) / 2.0
    au.au43_eyes_closed = clip01(1.0 - avg_ear * 3.5)

    # ── Head Pose ─────────────────────────────────────────────────────
    au.head_tilt_x = (lm[NOSE_TIP].y - lm[FOREHEAD_MID].y) / face_height
    au.head_tilt_y = (lm[NOSE_TIP].x - 0.5) * 2.0

    # ── Face Quality ──────────────────────────────────────────────────
    au.face_quality = clip01(1.0 - abs(au.head_tilt_y) * 1.5)

    return au
