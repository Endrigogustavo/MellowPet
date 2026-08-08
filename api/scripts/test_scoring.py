"""Standalone test of AU -> emotion scoring without loading MediaPipe."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def clip01(v):
    return max(0.0, min(1.0, float(v)))

def amp(v):
    if v < 0.025:
        return 0.0
    x = (v - 0.025) / 0.975
    return clip01(x ** 0.5 * 1.2)

def normalize(scores):
    total = sum(max(0.0, v) for v in scores.values()) or 1.0
    return {k: round(max(0.0, v) / total, 3) for k, v in scores.items()}

def au_to_scores(au):
    a1  = amp(au.get("au1", 0))
    a2  = amp(au.get("au2", 0))
    a4  = amp(au.get("au4", 0))
    a6  = amp(au.get("au6", 0))
    a9  = amp(au.get("au9", 0))
    a12 = amp(au.get("au12", 0))
    a15 = amp(au.get("au15", 0))
    a20 = amp(au.get("au20", 0))
    a25 = amp(au.get("au25", 0))
    a26 = amp(au.get("au26", 0))
    a43 = amp(au.get("au43", 0))

    happy_ev   = 0.50 * a12 + 0.30 * a6 + 0.20 * min(a12, a6)
    sad_ev     = 0.40 * a15 + 0.35 * a1 + 0.25 * a43
    angry_ev   = 0.45 * a4  + 0.30 * a9 + 0.25 * a20
    surpr_ev   = 0.30 * a1  + 0.25 * a2 + 0.25 * a26 + 0.20 * a25
    fear_ev    = 0.30 * a1  + 0.25 * a2 + 0.20 * a4  + 0.25 * a20
    anx_ev     = 0.35 * a4  + 0.30 * a20 + 0.20 * a1 + 0.15 * a43
    disg_ev    = 0.40 * a9  + 0.30 * a15 + 0.30 * a4

    happy_sup  = 0.25 * a4  + 0.20 * a15
    sad_sup    = 0.35 * a12 + 0.15 * a6
    angry_sup  = 0.25 * a12 + 0.15 * a1
    surpr_sup  = 0.35 * a43
    fear_sup   = 0.25 * a12
    anx_sup    = 0.30 * a12 + 0.15 * a6
    disg_sup   = 0.25 * a12

    scores = {
        "happy":     max(0.0, happy_ev - happy_sup),
        "sad":       max(0.0, sad_ev   - sad_sup),
        "angry":     max(0.0, angry_ev - angry_sup),
        "surprised": max(0.0, surpr_ev - surpr_sup),
        "fearful":   max(0.0, fear_ev  - fear_sup),
        "anxious":   max(0.0, anx_ev   - anx_sup),
        "disgusted": max(0.0, disg_ev  - disg_sup),
    }
    max_emotion = max(scores.values()) or 0.001
    scores["neutral"] = clip01(0.55 * (1.0 - max_emotion) ** 1.8)
    return normalize(scores)

# Typical blendshape values from MediaPipe for different expressions
tests = {
    "NEUTRAL": {"au12": 0.02, "au6": 0.01, "au15": 0.01, "au1": 0.01, "au4": 0.02},
    "HAPPY (smile)": {"au12": 0.35, "au6": 0.25, "au15": 0.01, "au1": 0.02, "au4": 0.01},
    "SAD (frown)": {"au15": 0.20, "au1": 0.25, "au43": 0.15, "au12": 0.02, "au6": 0.01},
    "ANGRY (brow)": {"au4": 0.30, "au9": 0.15, "au20": 0.10, "au12": 0.02, "au1": 0.01},
    "SURPRISED": {"au1": 0.30, "au2": 0.25, "au26": 0.30, "au25": 0.20, "au43": 0.01},
    "DISGUSTED": {"au9": 0.25, "au15": 0.18, "au4": 0.12, "au12": 0.02},
    # Realistic blendshape values (lower)
    "SUBTLE HAPPY": {"au12": 0.10, "au6": 0.07, "au15": 0.01},
    "SUBTLE SAD": {"au15": 0.08, "au1": 0.10, "au43": 0.06, "au12": 0.01},
}

for name, au in tests.items():
    scores = au_to_scores(au)
    top = sorted(scores.items(), key=lambda x: -x[1])
    winner = top[0]
    print(f"\n{name}:")
    print(f"AUs: {au}")
    print(f"Amplified: {', '.join(f'{k}={amp(v):.2f}' for k, v in au.items() if v > 0.02)}")
    for k, v in top[:4]:
        marker = " <<<" if k == top[0][0] else ""
        print(f"{k:12s}: {v:.3f}{marker}")
