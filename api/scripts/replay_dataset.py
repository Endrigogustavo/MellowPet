"""Executa o baseline Python sobre um manifesto JSONL sanitizado.

O replay e deliberadamente por amostra/frame. Clips temporais devem listar os
timestamps que receberam rotulo; isso torna a selecao reproduzivel e evita
medir frames diferentes em duas versoes do pipeline.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2

from services.emotion.service import EmotionDetectionService


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def _read_manifest(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            row = json.loads(line)
            if not row.get("sample_id") or not row.get("media_path"):
                raise ValueError(
                    f"{path}:{line_number} precisa de sample_id e media_path"
                )
            rows.append(row)
    return rows


def _load_frame(row: dict, manifest_dir: Path):
    media_path = Path(str(row["media_path"]))
    if not media_path.is_absolute():
        media_path = (manifest_dir / media_path).resolve()
    if media_path.suffix.lower() in IMAGE_SUFFIXES:
        frame = cv2.imread(str(media_path), cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError(f"Nao foi possivel ler imagem: {media_path}")
        return frame

    timestamp_ms = row.get("timestamp_ms")
    if timestamp_ms is None:
        raise ValueError(f"Amostra de video sem timestamp_ms: {row['sample_id']}")
    capture = cv2.VideoCapture(str(media_path))
    try:
        if not capture.isOpened():
            raise ValueError(f"Nao foi possivel abrir video: {media_path}")
        capture.set(cv2.CAP_PROP_POS_MSEC, float(timestamp_ms))
        ok, frame = capture.read()
        if not ok or frame is None:
            raise ValueError(
                f"Frame indisponivel em {media_path} @ {timestamp_ms}ms"
            )
        return frame
    finally:
        capture.release()


def main() -> int:
    parser = argparse.ArgumentParser(description="Replay do baseline de expressoes")
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    rows = _read_manifest(args.manifest)
    engine = EmotionDetectionService()
    args.output.parent.mkdir(parents=True, exist_ok=True)

    with args.output.open("w", encoding="utf-8") as output:
        for index, row in enumerate(rows, start=1):
            frame = _load_frame(row, args.manifest.parent)
            result = engine.detect_from_frame(frame)
            prediction = {
                "sample_id": str(row["sample_id"]),
                "predicted_label": result.emotion,
                "signal_status": result.signal_status,
                "signal_confidence": result.confidence,
                "distribution": result.all_scores,
                "quality_reasons": result.quality_reasons,
                "quality": result.face_quality_metrics,
                "latency_ms": result.processing_time_ms,
                "model_version": "ferplus-onnx+mediapipe-baseline@p0",
                "pipeline_version": result.pipeline_version,
            }
            output.write(json.dumps(prediction, ensure_ascii=False) + "\n")
            print(f"[{index}/{len(rows)}] {row['sample_id']} -> {result.emotion}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
