"""Action Units -> pontuacao de emocao, e derivacoes (variante, intensidade)."""
from typing import Optional

from .constants import COMPOUND_EMOTIONS
from .models import ActionUnits
from .util import clip01, normalize_scores


def au_to_emotion_scores(au: ActionUnits) -> dict[str, float]:
    """Convert Action Units to emotion probability scores using extended FACS rules.

    Uses 27 blendshapes (original 11 + 16 extended) for much finer emotion
    discrimination. Amplification compensates for naturally-small MediaPipe
    blendshapes. Contradictory suppression prevents false positives.
    """
    def amp(v: float, gate: float = 0.02) -> float:
        if v < gate:
            return 0.0
        x = (v - gate) / (1.0 - gate)
        return clip01(x ** 0.45 * 1.30)

    # Original AUs with lowered noise gates (baseline already subtracted)
    a1  = amp(au.au1_inner_brow_raise, 0.02)
    a2  = amp(au.au2_outer_brow_raise, 0.02)
    a4  = amp(au.au4_brow_lowerer, 0.02)
    a6  = amp(au.au6_cheek_raise, 0.02)
    a9  = amp(au.au9_nose_wrinkle, 0.03)
    a12 = amp(au.au12_lip_corner_pull, 0.03)
    a15 = amp(au.au15_lip_corner_depress, 0.02)
    a20 = amp(au.au20_lip_stretch, 0.03)
    a25 = amp(au.au25_lips_part, 0.03)
    a26 = amp(au.au26_jaw_drop, 0.03)
    a43 = amp(au.au43_eyes_closed, 0.03)

    # Extended AUs for fine-grained discrimination
    eye_wide  = amp((au.eye_wide_left + au.eye_wide_right) / 2.0, 0.02)
    eye_sqnt  = amp((au.eye_squint_left + au.eye_squint_right) / 2.0, 0.03)
    m_pucker  = amp(au.mouth_pucker, 0.03)
    m_press   = amp((au.mouth_press_left + au.mouth_press_right) / 2.0, 0.03)
    cheek_pf  = amp(au.cheek_puff, 0.04)
    jaw_lat   = amp((au.jaw_left + au.jaw_right) / 2.0, 0.03)
    m_dimple  = amp((au.mouth_dimple_left + au.mouth_dimple_right) / 2.0, 0.03)
    m_roll    = amp((au.mouth_roll_lower + au.mouth_roll_upper) / 2.0, 0.03)
    m_shrug   = amp((au.mouth_shrug_lower + au.mouth_shrug_upper) / 2.0, 0.03)
    # New extra channels
    m_lower   = amp(au.mouth_lower_down, 0.03)
    m_upper   = amp(au.mouth_upper_up, 0.03)
    m_lateral = amp((au.mouth_left + au.mouth_right) / 2.0, 0.03)

    # ── Positive evidence for each emotion ──

    # Happy: smile is the strongest signal, cheek raise confirms Duchenne
    smile_cheek = min(a12, a6)
    duchenne_bonus = 0.12 * eye_sqnt + 0.06 * m_dimple
    if a6 > 0.01:
        happy_ev = 0.35 * a12 + 0.25 * smile_cheek + 0.20 * a6 + duchenne_bonus
    else:
        happy_ev = 0.30 * a12

    # Sad: frown + oblique brow raise + eye droop; absence of smile boosts
    sad_base = (0.26 * a15 + 0.20 * a1 + 0.14 * a43 + 0.12 * a4
                + 0.08 * a20 + 0.08 * m_press + 0.05 * m_roll + 0.04 * eye_sqnt
                + 0.06 * m_lower)  # lower lip drop adds sadness signal
    no_smile_boost = max(0.0, 1.0 - a12 * 3.0)
    sad_ev = sad_base * (1.0 + 0.5 * no_smile_boost)
    # Co-occurrence: frown + oblique brow = strong sad signal
    if a15 > 0 and a1 > 0:
        sad_ev += 0.20 * min(a15, a1)
    # Frown + eyes closing = crying/tearful
    if a15 > 0 and a43 > 0:
        sad_ev += 0.14 * min(a15, a43)
    # Brow raise + lower lip drop = holding back tears
    if a1 > 0 and m_lower > 0:
        sad_ev += 0.10 * min(a1, m_lower)

    # Angry: brow lower + nose wrinkle; co-occurrence = very reliable
    angry_base = (0.26 * a4 + 0.22 * a9 + 0.14 * a20
                  + 0.10 * m_press + 0.08 * jaw_lat + 0.08 * m_shrug + 0.05 * m_roll
                  + 0.04 * m_lateral)  # mouth shift can signal anger
    if a4 > 0 and a9 > 0:
        angry_base += 0.24 * min(a4, a9)
    # Tight/pressed mouth boosts anger
    angry_ev = angry_base * (1.0 + 0.35 * m_press)
    # Brow lower + pressed lips = strong anger
    if a4 > 0 and m_press > 0:
        angry_ev += 0.12 * min(a4, m_press)

    # Surprised: brow raise, eye wide open, jaw drop, lips part
    surpr_ev = (0.22 * a1 + 0.20 * a2 + 0.20 * a26
                + 0.18 * eye_wide + 0.12 * a25 + 0.08 * m_shrug)

    # Fear: wide eyes + TENSE mouth (vs surprise's OPEN mouth)
    fear_base = (0.20 * a1 + 0.22 * eye_wide + 0.18 * a20
                 + 0.14 * a4 + 0.10 * a2 + 0.10 * m_press)
    # Mouth tension differentiates fear from surprise
    mouth_tension = max(0.0, a20 + m_press - a26 * 0.5)
    fear_ev = fear_base + 0.18 * mouth_tension
    # Fear triad: inner brow + wide eyes + lip stretch
    if a1 > 0 and eye_wide > 0 and a20 > 0:
        fear_ev += 0.18 * min(a1, eye_wide, a20)
    # Wide eyes + brow raise without jaw drop = fear not surprise
    if eye_wide > 0 and a1 > 0 and a26 < 0.1:
        fear_ev += 0.10 * min(eye_wide, a1)

    # Anxious: subtle micro-tensions, self-soothing mouth movements
    anx_base = (0.22 * a4 + 0.18 * a20 + 0.14 * a1
                + 0.12 * a43 + 0.12 * m_roll + 0.10 * m_press + 0.06 * jaw_lat + 0.04 * m_shrug)
    # Self-soothing gestures (lip rolling, pressing) amplify anxiety
    anx_ev = anx_base * (1.0 + 0.6 * (m_roll + m_press))
    # Lip rolling alone is a strong anxiety cue
    if m_roll > 0.1:
        anx_ev += 0.12 * m_roll

    # Disgusted: nose wrinkle dominant, upper lip raise, pucker, cheek involvement
    disg_base = (0.28 * a9 + 0.18 * a15 + 0.14 * a4
                 + 0.16 * m_pucker + 0.10 * cheek_pf + 0.08 * m_shrug
                 + 0.10 * m_upper + 0.06 * m_lateral)  # upper lip raise + mouth shift
    # Nose wrinkle + lip depress together = very strong disgust
    if a9 > 0 and a15 > 0:
        disg_base += 0.20 * min(a9, a15)
    if a9 > 0 and m_pucker > 0:
        disg_base += 0.12 * min(a9, m_pucker)
    # Upper lip raise + nose wrinkle = snarl (strongest disgust)
    if a9 > 0 and m_upper > 0:
        disg_base += 0.16 * min(a9, m_upper)
    disg_ev = disg_base

    # ── Per-emotion gain: compensate for naturally weaker AU signals ──
    # Happy/surprised already produce strong AUs; others need a lift.
    sad_ev   *= 1.50
    angry_ev *= 1.45
    fear_ev  *= 1.40
    anx_ev   *= 1.55
    disg_ev  *= 1.45

    # ── Contradictory suppression (minimal to avoid cancelling weak emotions) ──
    happy_sup  = 0.10 * a4 + 0.08 * a15 + 0.05 * a9
    sad_sup    = 0.08 * a12 + 0.04 * a6
    angry_sup  = 0.08 * a12 + 0.05 * a1
    surpr_sup  = 0.15 * a43 + 0.05 * a4
    fear_sup   = 0.08 * a12 + 0.04 * a6
    anx_sup    = 0.10 * a12 + 0.05 * a6
    disg_sup   = 0.08 * a12 + 0.04 * eye_wide

    scores = {
        "happy":     max(0.0, happy_ev - happy_sup),
        "sad":       max(0.0, sad_ev   - sad_sup),
        "angry":     max(0.0, angry_ev - angry_sup),
        "surprised": max(0.0, surpr_ev - surpr_sup),
        "fearful":   max(0.0, fear_ev  - fear_sup),
        "anxious":   max(0.0, anx_ev   - anx_sup),
        "disgusted": max(0.0, disg_ev  - disg_sup),
    }

    # Neutral: adaptive — strong when nothing fires, decays fast when emotions
    # separate clearly. Extended AUs help distinguish true neutral from subtle emotions.
    max_emotion = max(scores.values()) or 0.001
    second_max = sorted(scores.values(), reverse=True)[1] if len(scores) > 1 else 0.0
    separation_factor = 1.0 + max(0.0, max_emotion - second_max) * 2.5
    total_facial_activity = (a1 + a2 + a4 + a6 + a9 + a12 + a15 + a20 +
                             eye_wide + eye_sqnt + m_pucker + m_press +
                             m_lower + m_upper + m_lateral) / 15.0
    neutral_base = 0.30 * (1.0 - max_emotion) ** (1.4 * separation_factor)
    # When face is very active but no single emotion wins, reduce neutral
    neutral_base *= max(0.3, 1.0 - total_facial_activity * 1.5)
    scores["neutral"] = clip01(neutral_base)

    return normalize_scores(scores)

def post_fusion_corrections(scores: dict[str, float], au: Optional[ActionUnits]) -> dict[str, float]:
    """Apply AU-informed corrections to reduce false positives after ensemble fusion."""
    if au is None:
        return scores

    # If face mesh shows very low smile but ensemble says happy, suppress
    if scores.get("happy", 0) > 0.3 and au.au12_lip_corner_pull < 0.15 and au.au6_cheek_raise < 0.15:
        scores["happy"] *= 0.5
        scores["neutral"] = scores.get("neutral", 0) + 0.05

    # If face mesh shows strong Duchenne smile but ensemble misses it
    if au.au12_lip_corner_pull > 0.6 and au.au6_cheek_raise > 0.4 and scores.get("happy", 0) < 0.3:
        scores["happy"] = max(scores.get("happy", 0), 0.35)

    # If brows are relaxed but ensemble says angry, suppress
    if scores.get("angry", 0) > 0.3 and au.au4_brow_lowerer < 0.2:
        scores["angry"] *= 0.5
        scores["neutral"] = scores.get("neutral", 0) + 0.04

    # If eyes are very closed and ensemble says surprised, suppress
    if scores.get("surprised", 0) > 0.3 and au.au43_eyes_closed > 0.6:
        scores["surprised"] *= 0.4
        scores["neutral"] = scores.get("neutral", 0) + 0.04

    # If no nose wrinkle but ensemble says disgusted, suppress
    if scores.get("disgusted", 0) > 0.25 and au.au9_nose_wrinkle < 0.15:
        scores["disgusted"] *= 0.5
        scores["neutral"] = scores.get("neutral", 0) + 0.03

    return normalize_scores(scores)

def detect_compound_emotion(scores: dict[str, float]) -> Optional[str]:
    """Detect compound (mixed) emotions from co-activated scores."""
    best_compound = None
    best_strength = 0.0
    for compound, spec in COMPOUND_EMOTIONS.items():
        e1, e2 = spec["requires"]
        min1, min2 = spec["min_scores"]
        s1 = scores.get(e1, 0.0)
        s2 = scores.get(e2, 0.0)
        if s1 >= min1 and s2 >= min2:
            strength = s1 + s2
            if strength > best_strength:
                best_strength = strength
                best_compound = compound
    return best_compound

def classify_intensity(confidence: float, au: Optional[ActionUnits]) -> str:
    """Map confidence + AU activation to a human-readable intensity level."""
    au_energy = 0.0
    if au is not None:
        au_energy = (
            au.au1_inner_brow_raise + au.au4_brow_lowerer +
            au.au6_cheek_raise + au.au9_nose_wrinkle +
            au.au12_lip_corner_pull + au.au15_lip_corner_depress +
            au.au20_lip_stretch + au.au25_lips_part +
            au.au26_jaw_drop
        ) / 9.0
    combined = confidence * 0.55 + au_energy * 0.45
    if combined >= 0.65:
        return "extreme"
    if combined >= 0.50:
        return "intense"
    if combined >= 0.35:
        return "moderate"
    if combined >= 0.18:
        return "mild"
    return "calm"


def derive_variant(emotion: str, confidence: float, secondary: Optional[str]) -> tuple[str, str, str]:
    secondary = secondary or ""
    variants_map = {
        "happy": [
            "joyful", "playful", "grateful", "euphoric", "content", "cheerful",
            "optimistic", "inspired", "confident", "lighthearted",
        ],
        "sad": [
            "downcast", "lonely", "disappointed", "drained", "nostalgic", "melancholic",
            "hopeless", "sensitive", "withdrawn", "vulnerable",
        ],
        "angry": [
            "irritated", "frustrated", "upset", "furious", "offended", "impatient",
            "resentful", "agitated", "tense", "reactive",
        ],
        "anxious": [
            "worried", "tense", "restless", "overwhelmed", "on-edge", "uncertain",
            "pressured", "preoccupied", "hypervigilant", "shaky",
        ],
        "neutral": [
            "calm", "focused", "reflective", "steady", "composed", "present",
            "centered", "balanced", "settled", "attentive",
        ],
        "surprised": [
            "amazed", "shocked", "curious", "impressed", "astonished", "intrigued",
            "startled", "engaged", "alert", "energized",
        ],
        "disgusted": [
            "uncomfortable", "repulsed", "doubtful", "avoidant", "averted", "disturbed",
            "averse", "disapproving", "uneasy", "rejecting",
        ],
        "fearful": [
            "insecure", "hesitant", "afraid", "alarmed", "guarded", "intimidated",
            "apprehensive", "panicked", "threatened", "fragile",
        ],
    }

    tips_map = {
        "happy": "Aproveite esse momento e compartilhe algo bom com quem voce gosta.",
        "sad": "Tome agua, respire por 1 minuto e busque apoio de alguem de confianca.",
        "angry": "Pare por 30 segundos e solte o ar lentamente antes de reagir.",
        "anxious": "Observe 5 coisas ao redor e desacelere sua respiracao.",
        "neutral": "Bom momento para manter uma rotina simples e equilibrada.",
        "surprised": "Use essa energia para uma acao positiva e planejada.",
        "disgusted": "Afaste-se do gatilho por alguns minutos e recupere conforto.",
        "fearful": "Priorize seguranca e converse com alguem para reduzir a tensao.",
    }

    zones = {
        "happy": "positive",
        "surprised": "positive",
        "neutral": "balanced",
        "sad": "support-needed",
        "angry": "support-needed",
        "anxious": "support-needed",
        "disgusted": "support-needed",
        "fearful": "support-needed",
    }

    variants = variants_map.get(emotion, ["steady", "calm", "focused", "present"])
    conf_bucket = min(len(variants) - 1, int(confidence * len(variants)))
    idx = (conf_bucket + len(secondary)) % len(variants)
    if confidence >= 0.82:
        idx = min(idx + 1, len(variants) - 1)

    variant = variants[idx]
    zone = zones.get(emotion, "balanced")
    tip = tips_map.get(emotion, "Respire com calma e siga em passos pequenos.")
    return variant, zone, tip
