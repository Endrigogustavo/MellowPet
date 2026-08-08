"""
Constantes da deteccao de emocao: rotulos, indices de landmark e conteudo."""
EMOTION_MAP = {
    "happy": "happy",
    "sad": "sad",
    "angry": "angry",
    "fear": "anxious",
    "disgust": "disgusted",
    "surprise": "surprised",
    "neutral": "neutral",
}

NEGATIVE_EMOTIONS = {"sad", "angry", "anxious", "disgusted", "fearful"}
POSITIVE_EMOTIONS = {"happy", "surprised"}

# MediaPipe Face Mesh landmark indices for Action Unit estimation
# Lip corners
LIP_LEFT = 61
LIP_RIGHT = 291
LIP_TOP = 13
LIP_BOTTOM = 14
UPPER_LIP_TOP = 0
LOWER_LIP_BOTTOM = 17

# Eyes
LEFT_EYE_TOP = 159
LEFT_EYE_BOTTOM = 145
LEFT_EYE_INNER = 133
LEFT_EYE_OUTER = 33
RIGHT_EYE_TOP = 386
RIGHT_EYE_BOTTOM = 374
RIGHT_EYE_INNER = 362
RIGHT_EYE_OUTER = 263

# Eyebrows
LEFT_BROW_INNER = 107
LEFT_BROW_OUTER = 70
LEFT_BROW_MID = 105
RIGHT_BROW_INNER = 336
RIGHT_BROW_OUTER = 300
RIGHT_BROW_MID = 334

# Nose
NOSE_TIP = 1
NOSE_BRIDGE = 6

# Jaw
JAW_LEFT = 234
JAW_RIGHT = 454
JAW_BOTTOM = 152

# Cheeks
LEFT_CHEEK = 123
RIGHT_CHEEK = 352

# Forehead reference
FOREHEAD_MID = 10

EMOTION_MESSAGES = {
    "happy": [
        "Que sorriso lindo! Seu pet está adorando ver você assim 🌟",
        "Você está radiante hoje! Isso contagia até o {pet_name}! 😄",
        "Felicidade é contagiante — e o {pet_name} já percebeu! ",
    ],
    "sad": [
        "Parece que você está passando por um momento difícil. O {pet_name} está aqui com você 💙",
        "Tudo bem ficar triste às vezes. O {pet_name} manda um abraço virtual 🤗",
        "Você não está sozinho(a). O {pet_name} sente a sua presença e te acompanha 💜",
    ],
    "angry": [
        "Respira fundo... o {pet_name} está aqui para te acalmar 🌿",
        "Momentos difíceis passam. O {pet_name} te convida para uma pausa 🍃",
        "Que tal uma respiração profunda com o {pet_name}? Inspira... expira... 💨",
    ],
    "anxious": [
        "O {pet_name} percebeu que você pode estar preocupado(a). Você está seguro(a) 🛡️",
        "Vamos respirar juntos? O {pet_name} fica do seu lado 💛",
        "Um passo de cada vez. O {pet_name} acredita em você! 🌱",
    ],
    "neutral": [
        "O {pet_name} está de olho em você, com carinho ",
        "Dia tranquilo? O {pet_name} curte essa energia 😊",
        "Tudo em paz por aqui! O {pet_name} está feliz com sua companhia ✨",
    ],
    "surprised": [
        "Uau! O {pet_name} também se surpreendeu! 😲",
        "Algo inesperado? O {pet_name} adorou a reação! ",
    ],
    "disgusted": [
        "O {pet_name} faz a mesma cara às vezes 😅 Tudo vai melhorar!",
        "Passou alguma coisa ruim? O {pet_name} está aqui para alegrar seu dia 🌈",
    ],
}

MUSIC_SUGGESTIONS = {
    "sad": ["Weightless - Marconi Union", "Clair de Lune - Debussy", "Someone Like You - Adele"],
    "angry": ["Breathe (2 AM) - Anna Nalick", "Fix You - Coldplay", "The Sound of Silence"],
    "anxious": ["Gymnopédie No.1 - Satie", "River Flows in You - Yiruma", "Experience - Ludovico"],
    "happy": ["Happy - Pharrell Williams", "Good as Hell - Lizzo", "Can't Stop the Feeling"],
    "neutral": ["Lo-fi Hip Hop Beats", "Nature Sounds", "Ambient Focus Playlist"],
}

COMPOUND_EMOTIONS = {
    "bittersweet":  {"requires": ("happy", "sad"),       "min_scores": (0.18, 0.15), "label": "Agridoce"},
    "frustrated":   {"requires": ("angry", "sad"),       "min_scores": (0.18, 0.15), "label": "Frustrado(a)"},
    "awe":          {"requires": ("surprised", "happy"), "min_scores": (0.20, 0.15), "label": "Encantado(a)"},
    "anxious_sad":  {"requires": ("anxious", "sad"),     "min_scores": (0.18, 0.15), "label": "Triste e ansioso(a)"},
    "nervous_excited": {"requires": ("anxious", "happy"), "min_scores": (0.16, 0.16), "label": "Nervoso(a) empolgado(a)"},
    "contempt":     {"requires": ("angry", "disgusted"), "min_scores": (0.18, 0.15), "label": "Desdenhoso(a)"},
    "apprehensive": {"requires": ("fearful", "anxious"), "min_scores": (0.16, 0.16), "label": "Apreensivo(a)"},
    "melancholic":  {"requires": ("sad", "neutral"),     "min_scores": (0.20, 0.25), "label": "Melancólico(a)"},
    "embarrassed":  {"requires": ("surprised", "anxious"), "min_scores": (0.15, 0.15), "label": "Envergonhado(a)"},
}

# ── rPPG (estimativa de batimento pelo sinal de verde) ──────────────────
RPPG_WINDOW_SEC = 20.0       # seconds of data needed for estimation
RPPG_MIN_SAMPLES = 12        # minimum frames (at ~1 fps, 12 seconds)
RPPG_BPM_LOW = 45.0
RPPG_BPM_HIGH = 180.0

# ── Calibracao e votacao temporal ───────────────────────────────────────
CALIBRATION_FRAMES = 5     # primeiros N frames para aprender o rosto em repouso
BASELINE_FRACTION = 0.60   # subtrai so 60% do baseline de repouso
VOTE_WINDOW = 3            # media dos ultimos N frames
