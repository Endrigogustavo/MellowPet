"""rPPG: estimativa de batimento cardiaco pelo canal verde do rosto."""
from typing import Optional

import numpy as np

from .constants import RPPG_BPM_HIGH, RPPG_BPM_LOW, RPPG_MIN_SAMPLES, RPPG_WINDOW_SEC
from .models import SessionTemporalState
from .util import clip01, normalize_scores
from utils.logger import setup_logger

logger = setup_logger(__name__)


def extract_rppg_signal(frame: np.ndarray, landmarks) -> Optional[float]:
    """Extract mean green-channel intensity from forehead/cheek ROI.

    The face landmarks are used to identify a stable forehead region
    where skin is visible and capillary pulsation can be measured.
    """
    try:
        h, w = frame.shape[:2]

        if landmarks is not None and len(landmarks) >= 468:
            # Use forehead region between brows and hairline
            # Landmarks: 10 (top of forehead), 107/336 (inner brows), 67/297 (forehead sides)
            pts = []
            for idx in [10, 67, 109, 108, 107, 336, 337, 338, 297]:
                lm = landmarks[idx]
                pts.append((int(lm.x * w), int(lm.y * h)))
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            x1 = max(0, min(xs))
            y1 = max(0, min(ys))
            x2 = min(w, max(xs))
            y2 = min(h, max(ys))
        else:
            # Fallback: center-top region of frame (approximate forehead)
            x1 = int(w * 0.3)
            x2 = int(w * 0.7)
            y1 = int(h * 0.1)
            y2 = int(h * 0.3)

        if x2 <= x1 or y2 <= y1:
            return None

        roi = frame[y1:y2, x1:x2]
        if roi.size == 0:
            return None

        # Mean of green channel (best SNR for rPPG)
        green_mean = float(np.mean(roi[:, :, 1]))
        return green_mean
    except Exception:
        return None


def compute_heart_rate(state: SessionTemporalState) -> tuple[Optional[float], float, str]:
    """Compute heart rate from accumulated rPPG green-channel signal.

    Returns (bpm, confidence, status).
    """
    timestamps = state.rppg_timestamps
    signal = state.rppg_green_means

    if len(signal) < RPPG_MIN_SAMPLES:
        return None, 0.0, "collecting"

    # Keep only the last RPPG_WINDOW_SEC of data
    now = timestamps[-1]
    cutoff = now - RPPG_WINDOW_SEC
    while len(timestamps) > 0 and timestamps[0] < cutoff:
        timestamps.pop(0)
        signal.pop(0)

    if len(signal) < RPPG_MIN_SAMPLES:
        return None, 0.0, "collecting"

    try:
        sig = np.array(signal, dtype=np.float64)
        ts = np.array(timestamps, dtype=np.float64)

        # Estimate sampling rate from timestamps
        dt = np.diff(ts)
        if len(dt) == 0 or np.mean(dt) < 0.1:
            return None, 0.0, "unstable"
        fs = 1.0 / np.mean(dt)

        # Detrend: subtract moving average (window ~5 samples)
        kernel_size = min(5, len(sig) - 1)
        if kernel_size < 2:
            return None, 0.0, "collecting"
        kernel = np.ones(kernel_size) / kernel_size
        trend = np.convolve(sig, kernel, mode="same")
        detrended = sig - trend

        # Apply Hamming window to reduce spectral leakage
        window = np.hamming(len(detrended))
        windowed = detrended * window

        # FFT
        n = len(windowed)
        fft_vals = np.fft.rfft(windowed)
        fft_freqs = np.fft.rfftfreq(n, d=1.0 / fs)
        magnitudes = np.abs(fft_vals)

        # Filter to physiological heart rate range
        freq_low = RPPG_BPM_LOW / 60.0   # ~0.75 Hz
        freq_high = RPPG_BPM_HIGH / 60.0  # ~3.0 Hz
        mask = (fft_freqs >= freq_low) & (fft_freqs <= freq_high)

        if not np.any(mask):
            return None, 0.0, "unstable"

        valid_freqs = fft_freqs[mask]
        valid_mags = magnitudes[mask]

        # Find dominant frequency
        peak_idx = np.argmax(valid_mags)
        peak_freq = valid_freqs[peak_idx]
        peak_mag = valid_mags[peak_idx]

        bpm = round(peak_freq * 60.0, 1)

        # Confidence: ratio of peak to total spectral energy in band
        total_energy = np.sum(valid_mags ** 2) or 1.0
        peak_energy = peak_mag ** 2
        snr = peak_energy / total_energy
        confidence = clip01(snr * 2.5)  # scale to 0–1

        # Require minimum confidence
        if confidence < 0.15:
            return state.rppg_last_bpm, confidence, "unstable"

        # Smooth with previous reading
        if state.rppg_last_bpm is not None:
            bpm = round(0.3 * state.rppg_last_bpm + 0.7 * bpm, 1)

        state.rppg_last_bpm = bpm
        state.rppg_last_confidence = confidence

        logger.debug("rPPG | bpm=%.1f confidence=%.2f samples=%d fs=%.1f", bpm, confidence, len(signal), fs)

        return bpm, confidence, "ready"
    except Exception as e:
        logger.debug("rPPG computation error: %s", e)
        return state.rppg_last_bpm, 0.0, "unstable"


def hr_emotion_adjustment(scores: dict[str, float], bpm: Optional[float], hr_confidence: float) -> dict[str, float]:
    """Adjust emotion scores based on heart rate context.

    High HR (>90) -> boost arousal emotions (anxious, angry, surprised, happy)
    Low HR (<65) -> boost valence emotions (sad, calm/neutral)
    Normal (65-90) -> no adjustment
    """
    if bpm is None or hr_confidence < 0.25:
        return scores

    adjusted = dict(scores)

    if bpm > 95:
        # High heart rate: person is aroused — boost high-arousal emotions
        boost = min(0.15, (bpm - 95) / 200.0) * hr_confidence
        for emo in ["anxious", "angry", "surprised", "happy"]:
            adjusted[emo] = adjusted.get(emo, 0) + boost
        for emo in ["neutral", "sad"]:
            adjusted[emo] = max(0, adjusted.get(emo, 0) - boost * 0.5)
    elif bpm < 62:
        # Low heart rate: person is calm/subdued — boost low-arousal emotions
        boost = min(0.12, (62 - bpm) / 150.0) * hr_confidence
        for emo in ["sad", "neutral"]:
            adjusted[emo] = adjusted.get(emo, 0) + boost
        for emo in ["surprised", "angry", "anxious"]:
            adjusted[emo] = max(0, adjusted.get(emo, 0) - boost * 0.5)

    return normalize_scores(adjusted)
