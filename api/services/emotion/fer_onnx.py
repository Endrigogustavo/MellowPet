"""
Classificador de expressao facial em ONNX Runtime (modelo FER+).

Substitui o DeepFace/TensorFlow. A troca vale por tres motivos concretos:

  - Peso: onnxruntime ~15 MB contra ~1 GB de tensorflow + tf-keras + deepface.
  - Partida: sessao pronta em ~1 s, contra dezenas de segundos do TensorFlow.
  - Portabilidade: funciona em Python 3.13, onde o DeepFace estava desligado —
    ou seja, naquele runtime o ensemble rodava sem nenhum classificador
    treinado, apenas com heuristica de Action Units.

O modelo espera um recorte do rosto em escala de cinza 64x64. A qualidade do
recorte importa mais que qualquer ajuste de limiar: o FER+ foi treinado com
faces centralizadas e enquadradas de forma parecida, entao `_crop_face` replica
esse enquadramento a partir da bounding box.
"""
from __future__ import annotations

import os
import threading
from typing import Optional

import cv2
import numpy as np

from utils.logger import setup_logger

from .assets import FER_ONNX, ensure_model
from .util import normalize_scores

logger = setup_logger(__name__)

# Ordem das 8 saidas do FER+, conforme o modelo no ONNX Model Zoo.
FERPLUS_LABELS = ("neutral",
    "happiness",
    "surprise",
    "sadness",
    "anger",
    "disgust",
    "fear",
    "contempt",
)

# FER+ -> vocabulario interno. "contempt" nao existe no nosso conjunto; o mais
# proximo em valencia/leitura pelo usuario e o desgosto.
_TO_INTERNAL = {
    "neutral": "neutral",
    "happiness": "happy",
    "surprise": "surprised",
    "sadness": "sad",
    "anger": "angry",
    "disgust": "disgusted",
    "fear": "fearful",
    "contempt": "disgusted",
}

INPUT_SIZE = 64

# Fracao da bounding box adicionada em cada lado. O FER+ espera um pouco de
# testa e queixo; a box do BlazeFace vem justa no rosto.
_BOX_MARGIN = 0.18


def _softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - np.max(logits)
    exp = np.exp(shifted)
    return exp / (np.sum(exp) or 1.0)


class FerOnnxClassifier:
    """Sessao ONNX carregada uma vez e reutilizada entre requisicoes."""

    # Medido num host de 4 nucleos: 1 thread = 22 ms, 2 = 17 ms, 4 = 65 ms.
    # Passar de 2 piora — as threads disputam os mesmos nucleos que o MediaPipe
    # e as requisicoes concorrentes ja ocupam. Ajustavel por FER_NUM_THREADS.
    DEFAULT_THREADS = 2

    def __init__(self, num_threads: Optional[int] = None):
        self._session = None
        self._input_name: Optional[str] = None
        self._output_name: Optional[str] = None
        self._lock = threading.Lock()
        requested = num_threads if num_threads is not None else self.DEFAULT_THREADS
        self._num_threads = max(1, min(requested, os.cpu_count() or 1))
        self.available = False
        self._load()

    def _load(self) -> None:
        try:
            import onnxruntime as ort
        except ImportError:
            logger.warning("onnxruntime nao instalado — classificador FER desligado, ""restando apenas os blendshapes do MediaPipe")
            return

        try:
            model_path = ensure_model(FER_ONNX)
        except Exception as exc:
            logger.warning("Nao foi possivel obter o modelo FER (%s)", exc)
            return

        try:
            options = ort.SessionOptions()
            # Limitar as threads e proposital: usar todos os nucleos deixou a
            # inferencia 3x mais lenta na medicao, porque disputa CPU com o
            # MediaPipe e com as outras requisicoes em voo.
            options.intra_op_num_threads = self._num_threads
            options.inter_op_num_threads = 1
            options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

            self._session = ort.InferenceSession(
                str(model_path),
                sess_options=options,
                providers=["CPUExecutionProvider"],
            )
            self._input_name = self._session.get_inputs()[0].name
            self._output_name = self._session.get_outputs()[0].name
            self.available = True
            logger.info("Classificador FER ONNX carregado (entrada=%s saida=%s threads=%d)",
                self._input_name,
                self._output_name,
                self._num_threads,
            )
        except Exception as exc:
            logger.error("Falha ao iniciar a sessao ONNX: %s", exc)

    @staticmethod
    def _crop_face(frame: np.ndarray, box: Optional[tuple[int, int, int, int]]) -> np.ndarray:
        """Recorta e enquadra o rosto no formato que o FER+ espera.

        `box` e (x, y, w, h). Sem box, usa o quadrado central do frame — melhor
        que a imagem inteira, porque o modelo espera o rosto preenchendo o
        enquadramento.
        """
        height, width = frame.shape[:2]

        if box is None:
            side = min(height, width)
            x = (width - side) // 2
            y = (height - side) // 2
            w = h = side
        else:
            x, y, w, h = box
            margin_x = int(w * _BOX_MARGIN)
            margin_y = int(h * _BOX_MARGIN)
            x -= margin_x
            y -= margin_y
            w += margin_x * 2
            h += margin_y * 2

            # Quadrado: esticar para 64x64 um retangulo deformaria as feicoes.
            side = max(w, h)
            x -= (side - w) // 2
            y -= (side - h) // 2
            w = h = side

        x0 = max(0, x)
        y0 = max(0, y)
        x1 = min(width, x + w)
        y1 = min(height, y + h)

        if x1 <= x0 or y1 <= y0:
            return np.zeros((INPUT_SIZE, INPUT_SIZE), dtype=np.uint8)

        crop = frame[y0:y1, x0:x1]
        if crop.ndim == 3:
            crop = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

        # INTER_AREA para reducao: preserva melhor o contraste das feicoes que
        # a interpolacao linear.
        return cv2.resize(crop, (INPUT_SIZE, INPUT_SIZE), interpolation=cv2.INTER_AREA)

    @staticmethod
    def _preprocess(face_gray: np.ndarray) -> np.ndarray:
        """Equaliza e monta o tensor 1x1x64x64.

        A equalizacao de histograma aproxima o brilho/contraste do frame ao das
        imagens de treino do FER+, o que reduz o erro em luz ruim.
        """
        equalized = cv2.equalizeHist(face_gray)
        tensor = equalized.astype(np.float32)
        return tensor.reshape(1, 1, INPUT_SIZE, INPUT_SIZE)

    def predict(
        self,
        frame: np.ndarray,
        face_box: Optional[tuple[int, int, int, int]] = None,
    ) -> Optional[dict[str, float]]:
        """
        Pontuacoes por emocao no vocabulario interno, ou None se indisponivel."""
        if not self.available or self._session is None:
            return None

        try:
            face = self._crop_face(frame, face_box)
            tensor = self._preprocess(face)

            # A sessao do ONNX Runtime nao garante reentrancia entre threads.
            with self._lock:
                logits = self._session.run([self._output_name], {self._input_name: tensor})[0]

            probabilities = _softmax(np.asarray(logits, dtype=np.float64).ravel())

            scores: dict[str, float] = {}
            for label, probability in zip(FERPLUS_LABELS, probabilities):
                internal = _TO_INTERNAL[label]
                # "contempt" e "disgust" caem no mesmo rotulo interno; soma.
                scores[internal] = scores.get(internal, 0.0) + float(probability)

            return normalize_scores(scores)
        except Exception as exc:
            logger.error("Inferencia FER falhou: %s", exc)
            return None
