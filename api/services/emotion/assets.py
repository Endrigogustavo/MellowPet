"""
Download e verificacao dos modelos usados pelo motor de emocao.

Os pesos nao vao no repositorio (dezenas de MB), entao sao baixados na primeira
execucao e ficam em cache no disco. Cada modelo tem SHA-256 fixado: um arquivo
baixado da rede e alimentado a um runtime de inferencia, e sem conferir o hash
uma resposta corrompida — ou um CDN comprometido — entraria no processo sem
ninguem notar.

As URLs apontam para versoes fixas (`/1/`, nao `/latest/`) justamente para o
checksum continuar valido quando o fornecedor publicar uma versao nova.
"""
from __future__ import annotations

import hashlib
import os
import shutil
import tempfile
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from utils.logger import setup_logger

logger = setup_logger(__name__)

DEFAULT_CACHE_DIR = Path(os.getenv("MELLOWPET_MODEL_DIR", "~/.mellowpet/models")).expanduser()

_DOWNLOAD_TIMEOUT = 180
_CHUNK = 1 << 16


@dataclass(frozen=True)
class ModelAsset:
    """Um arquivo de modelo com origem e hash esperados."""
    name: str
    url: str
    sha256: str
    size_bytes: int

    @property
    def filename(self) -> str:
        return self.name


# ── Modelos ─────────────────────────────────────────────────────────────────
# Classificador de expressao facial (FER+, 8 classes, ONNX Model Zoo).
# Entrada 1x1x64x64 em escala de cinza; saida 8 logits.
FER_ONNX = ModelAsset(
    name="emotion-ferplus-8.onnx",
    url=("https://github.com/onnx/models/raw/main/validated/vision/""body_analysis/emotion_ferplus/model/emotion-ferplus-8.onnx"),
    sha256="a2a2ba6a335a3b29c21acb6272f962bd3d47f84952aaffa03b60986e04efa61c",
    size_bytes=35_040_571,
)

# MediaPipe Face Landmarker: 478 landmarks + 52 blendshapes.
FACE_LANDMARKER = ModelAsset(
    name="face_landmarker.task",
    url=("https://storage.googleapis.com/mediapipe-models/face_landmarker/""face_landmarker/float16/1/face_landmarker.task"),
    sha256="64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff",
    size_bytes=3_758_596,
)

# MediaPipe BlazeFace: deteccao de bounding box (recorte para o FER).
FACE_DETECTOR = ModelAsset(
    name="blaze_face_short_range.tflite",
    url=("https://storage.googleapis.com/mediapipe-models/face_detector/""blaze_face_short_range/float16/1/blaze_face_short_range.tflite"),
    sha256="b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f",
    size_bytes=229_746,
)

ALL_MODELS = (FER_ONNX, FACE_LANDMARKER, FACE_DETECTOR)


class ModelIntegrityError(RuntimeError):
    """O arquivo baixado nao corresponde ao hash esperado."""


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(_CHUNK), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _download_to(asset: ModelAsset, target: Path) -> None:
    """Baixa para um temporario e só promove ao destino se o hash conferir.

    Escrever direto no destino deixaria um arquivo truncado no cache se a
    conexao caisse no meio, e a execucao seguinte o trataria como valido.
    """
    target.parent.mkdir(parents=True, exist_ok=True)
    logger.info("Baixando modelo %s (%.1f MB)", asset.name, asset.size_bytes / 1e6)

    request = urllib.request.Request(asset.url, headers={"User-Agent": "MellowPet/1.0"})
    fd, tmp_name = tempfile.mkstemp(dir=str(target.parent), suffix=".part")
    tmp = Path(tmp_name)
    try:
        with os.fdopen(fd, "wb") as out, urllib.request.urlopen(
            request, timeout=_DOWNLOAD_TIMEOUT
        ) as response:
            shutil.copyfileobj(response, out, _CHUNK)

        actual = _sha256(tmp)
        if actual != asset.sha256:
            raise ModelIntegrityError(
                f"{asset.name}: SHA-256 esperado {asset.sha256}, obtido {actual}. ""Download descartado.")
        tmp.replace(target)
        logger.info("Modelo %s verificado e salvo em %s", asset.name, target)
    finally:
        tmp.unlink(missing_ok=True)


def ensure_model(asset: ModelAsset, cache_dir: Path | None = None) -> Path:
    """Devolve o caminho local do modelo, baixando e verificando se preciso.

    Um arquivo em cache com hash divergente e reprovado e baixado de novo — e o
    que acontece quando o download anterior parou pela metade.
    """
    directory = cache_dir or DEFAULT_CACHE_DIR
    target = directory / asset.filename

    if target.exists():
        actual = _sha256(target)
        if actual == asset.sha256:
            return target
        logger.warning("Modelo em cache %s com hash inesperado (%s) — baixando novamente",
            asset.name,
            actual[:16],
        )
        target.unlink()

    _download_to(asset, target)
    return target


def prefetch_all(cache_dir: Path | None = None) -> dict[str, Path]:
    """Baixa todos os modelos de uma vez.

    Chamado pelo build da imagem Docker para que o primeiro request em producao
    nao pague o download.
    """
    return {asset.name: ensure_model(asset, cache_dir) for asset in ALL_MODELS}
