"""
Decodificacao e pre-processamento de frames."""
import base64
from typing import Optional

import cv2
import numpy as np

from utils.logger import setup_logger

logger = setup_logger(__name__)


def apply_exif_rotation(img_bytes: bytes) -> Optional[np.ndarray]:
    """
    Decode image with EXIF orientation applied using Pillow."""
    try:
        from PIL import Image, ImageOps
        import io
        pil_img = Image.open(io.BytesIO(img_bytes))
        pil_img = ImageOps.exif_transpose(pil_img)
        if pil_img.mode != "RGB":
            pil_img = pil_img.convert("RGB")
        return np.array(pil_img)
    except Exception:
        return None

def decode_frame(frame_data: str) -> Optional[np.ndarray]:
    """
    Decode base64 frame to numpy array with EXIF rotation support."""
    try:
        if "," in frame_data:
            frame_data = frame_data.split(",")[1]
        img_bytes = base64.b64decode(frame_data)

        # Use Pillow to handle EXIF orientation (mobile cameras embed rotation tags)
        frame = apply_exif_rotation(img_bytes)
        if frame is None:
            # Fallback to OpenCV (no EXIF rotation)
            np_buffer = np.frombuffer(img_bytes, dtype=np.uint8)
            decoded = cv2.imdecode(np_buffer, cv2.IMREAD_COLOR)
            if decoded is None:
                raise ValueError("invalid image bytes")
            frame = cv2.cvtColor(decoded, cv2.COLOR_BGR2RGB)

        # Higher max dimension for better landmark precision
        h, w = frame.shape[:2]
        max_dim = max(h, w)
        if max_dim > 1024:
            scale = 1024.0 / float(max_dim)
            frame = cv2.resize(
                frame,
                (max(1, int(w * scale)), max(1, int(h * scale))),
                interpolation=cv2.INTER_AREA,
            )

        logger.debug("frame decoded | shape=%s", frame.shape)
        return frame
    except Exception as e:
        logger.error(f"Frame decode error: {e}")
        return None

def enhance_frame(frame: np.ndarray) -> np.ndarray:
    """
    Improve contrast/sharpness while preserving natural facial tones."""
    try:
        # Skip heavy enhancement when frame quality is already good.
        gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
        brightness = float(np.mean(gray)) / 255.0
        contrast = float(np.std(gray)) / 64.0
        sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var()) / 140.0
        quality_ok = 0.18 <= brightness <= 0.9 and contrast >= 0.5 and sharpness >= 0.33
        if quality_ok:
            return frame

        lab = cv2.cvtColor(frame, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        merged = cv2.merge((l, a, b))
        rgb = cv2.cvtColor(merged, cv2.COLOR_LAB2RGB)

        # Mild unsharp mask to emphasize expression edges.
        blurred = cv2.GaussianBlur(rgb, (0, 0), sigmaX=1.1, sigmaY=1.1)
        sharpened = cv2.addWeighted(rgb, 1.18, blurred, -0.18, 0)
        return sharpened
    except Exception as e:
        logger.debug("frame enhancement skipped: %s", e)
        return frame
