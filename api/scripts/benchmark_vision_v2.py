"""Microbenchmark ASGI do contrato V2, sem rede e sem qualquer dado facial."""
from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import tempfile
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path

import databases
import httpx
import sqlalchemy
from fastapi import FastAPI

from routers import vision_v2
from utils.database import metadata

# O benchmark reporta o resumo final; logs por lote distorcem I/O e poluem CI.
vision_v2.logger.setLevel("WARNING")


def percentile(values: list[float], quantile: float) -> float:
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, int(len(ordered) * quantile + 0.999999) - 1))
    return ordered[index]


def event(sequence: int, item: int) -> dict:
    started = datetime.now(UTC) + timedelta(milliseconds=item * 100)
    return {
        "event_id": f"bench_{sequence:06d}_{item:02d}",
        "kind": "heartbeat",
        "started_at": started.isoformat(),
        "ended_at": (started + timedelta(seconds=15)).isoformat(),
        "duration_ms": 15_000,
        "observed_expression": "neutral",
        "expression_distribution": {"neutral": 0.8, "happy": 0.1, "sad": 0.1},
        "signal_confidence": 0.8,
        "quality": {"mean": 0.85, "accepted_coverage": 0.92, "reasons": []},
        "tension_signal": 0.12,
        "model_version": "expression-mobile@2.0.0",
        "pipeline_version": "vision-pipeline@2.0.0",
        "quality_config_version": "quality@1.0.0",
        "calibration_version": "personal-baseline@1",
        "source": "mobile",
    }


async def run(iterations: int, batch_size: int) -> dict:
    with tempfile.TemporaryDirectory(prefix="mellowpet-v2-") as temp_dir:
        db_path = Path(temp_dir) / "benchmark.db"
        async_url = f"sqlite+aiosqlite:///{db_path.as_posix()}"
        sync_engine = sqlalchemy.create_engine(f"sqlite:///{db_path.as_posix()}")
        metadata.create_all(sync_engine)
        benchmark_database = databases.Database(async_url)
        vision_v2.database = benchmark_database
        await benchmark_database.connect()

        app = FastAPI()
        app.include_router(vision_v2.router, prefix="/api/v2")
        transport = httpx.ASGITransport(app=app)
        latencies: list[float] = []
        failures = 0
        try:
            async with httpx.AsyncClient(transport=transport, base_url="http://benchmark") as client:
                for iteration in range(iterations + 5):
                    body = {
                        "session_id": "benchmark_session",
                        "device_session_id": "benchmark_device",
                        "events": [event(iteration, item) for item in range(batch_size)],
                    }
                    started = time.perf_counter()
                    response = await client.post("/api/v2/expression-events:batch", json=body)
                    elapsed_ms = (time.perf_counter() - started) * 1_000
                    if response.status_code != 200:
                        failures += 1
                    if iteration >= 5:
                        latencies.append(elapsed_ms)
        finally:
            await benchmark_database.disconnect()
            sync_engine.dispose()

    return {
        "scope": "in-process ASGI + Pydantic + SQLite; excludes network/TLS",
        "iterations": iterations,
        "events_per_batch": batch_size,
        "failures": failures,
        "latency_ms": {
            "mean": round(statistics.fmean(latencies), 3),
            "p50": round(percentile(latencies, 0.50), 3),
            "p95": round(percentile(latencies, 0.95), 3),
            "max": round(max(latencies), 3),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--iterations", type=int, default=100)
    parser.add_argument("--batch-size", type=int, default=10)
    args = parser.parse_args()
    if not 1 <= args.iterations <= 10_000 or not 1 <= args.batch_size <= 50:
        raise SystemExit("iterations must be 1..10000 and batch-size must be 1..50")
    print(json.dumps(asyncio.run(run(args.iterations, args.batch_size)), indent=2))


if __name__ == "__main__":
    main()
