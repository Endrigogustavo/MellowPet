"""
Testes do motor de emocao que nao exigem modelo carregado.

Cobrem as funcoes puras do pipeline (mapeamento, fusao, frames) e a cadeia de
fallback da IA. A deteccao com rosto real precisa de fotos e esta em
scripts/validate_detection.py, fora da suite automatica.
"""

import base64

import cv2
import numpy as np
import pytest

from services.emotion import frames, fusion, mapping, quality
from services.emotion.models import ActionUnits, EmotionResult
from services.emotion.temporal import TemporalTracker
from services.emotion.util import clip01, normalize_scores


class TestUtil:
    def test_clip01_prende_nos_limites(self):
        assert clip01(2.5) == 1.0
        assert clip01(-3) == 0.0
        assert clip01(0.42) == pytest.approx(0.42)

    def test_normalize_soma_um(self):
        out = normalize_scores({"a": 3.0, "b": 1.0})
        assert sum(out.values()) == pytest.approx(1.0)
        assert out["a"] == pytest.approx(0.75)

    def test_normalize_zera_negativos(self):
        out = normalize_scores({"a": 1.0, "b": -5.0})
        assert out["b"] == 0.0

    def test_normalize_nao_divide_por_zero(self):
        assert normalize_scores({"a": 0.0, "b": 0.0}) == {"a": 0.0, "b": 0.0}


class TestMapeamentoDeEmocao:
    def test_au_neutras_dao_neutral(self):
        scores = mapping.au_to_emotion_scores(ActionUnits())
        assert max(scores, key=scores.get) == "neutral"

    def test_sorriso_duchenne_da_happy(self):
        # AU12 (canto do labio) + AU6 (bochecha) e a assinatura do sorriso genuino.
        au = ActionUnits(au12_lip_corner_pull=0.9, au6_cheek_raise=0.8)
        scores = mapping.au_to_emotion_scores(au)
        assert max(scores, key=scores.get) == "happy"

    def test_intensidade_acompanha_confianca(self):
        forte = mapping.classify_intensity(0.95, ActionUnits(au12_lip_corner_pull=0.9))
        fraca = mapping.classify_intensity(0.10, ActionUnits())
        assert forte in ("intense", "extreme")
        assert fraca == "calm"

    def test_derive_variant_devolve_tripla(self):
        variant, zone, tip = mapping.derive_variant("happy", 0.8, "surprised")
        assert all(isinstance(x, str) and x for x in (variant, zone, tip))

    def test_ansiedade_nao_e_classe_visual(self):
        scores = mapping.au_to_emotion_scores(
            ActionUnits(
                au4_brow_lowerer=0.8,
                au20_lip_stretch=0.7,
                mouth_press_left=0.6,
                mouth_press_right=0.6,
            )
        )
        assert "anxious" not in scores

    def test_tensao_e_sinal_separado(self):
        calm = mapping.compute_tension_signal(ActionUnits())
        tense = mapping.compute_tension_signal(
            ActionUnits(
                au4_brow_lowerer=0.9,
                au20_lip_stretch=0.8,
                mouth_press_left=0.8,
                mouth_press_right=0.8,
            )
        )
        assert 0.0 <= calm < tense <= 1.0


class TestFusao:
    def test_resultado_soma_um(self):
        out = fusion.ensemble_fusion({"happy": 0.8, "sad": 0.2}, {"happy": 0.6, "sad": 0.4})
        assert sum(out.values()) == pytest.approx(1.0)

    def test_um_sinal_ausente_nao_quebra(self):
        out = fusion.ensemble_fusion(None, {"happy": 1.0})
        assert out["happy"] == pytest.approx(1.0)

    def test_sem_nenhum_sinal_devolve_neutral(self):
        assert fusion.ensemble_fusion(None, None) == {"neutral": 1.0}

    def test_pesos_deslocam_o_resultado(self):
        cnn = {"happy": 1.0, "sad": 0.0}
        landmarks = {"happy": 0.0, "sad": 1.0}
        so_cnn = fusion.ensemble_fusion(cnn, landmarks, weights=(1.0, 0.0, 0.0))
        so_lm = fusion.ensemble_fusion(cnn, landmarks, weights=(0.0, 1.0, 0.0))
        assert so_cnn["happy"] > 0.99
        assert so_lm["sad"] > 0.99

    def test_confianca_no_intervalo(self):
        c = fusion.compute_ensemble_confidence("happy", 0.7, 0.4, {"happy": 1}, {"happy": 1}, None)
        assert 0.0 <= c <= 1.0

    def test_concordancia_eleva_confianca(self):
        juntos = fusion.compute_ensemble_confidence(
            "happy", 0.7, 0.3, {"happy": 1.0}, {"happy": 1.0}, None
        )
        divergentes = fusion.compute_ensemble_confidence(
            "happy", 0.7, 0.3, {"happy": 1.0}, {"sad": 1.0}, None
        )
        assert juntos > divergentes


class TestFrames:
    @staticmethod
    def _b64_jpeg(shape=(120, 160, 3)) -> str:
        img = (np.random.rand(*shape) * 255).astype(np.uint8)
        ok, buf = cv2.imencode(".jpg", img)
        assert ok
        return base64.b64encode(buf.tobytes()).decode()

    def test_decodifica_jpeg_valido(self):
        out = frames.decode_frame(self._b64_jpeg())
        assert out is not None and out.ndim == 3

    def test_rejeita_base64_invalido(self):
        assert frames.decode_frame("nao-e-base64-!!!") is None

    def test_rejeita_bytes_que_nao_sao_imagem(self):
        assert frames.decode_frame(base64.b64encode(b"nao sou imagem").decode()) is None

    def test_enhance_preserva_dimensoes(self):
        img = (np.random.rand(80, 100, 3) * 255).astype(np.uint8)
        assert frames.enhance_frame(img).shape == img.shape


class TestEmotionResult:
    def test_coage_tipos(self):
        r = EmotionResult(emotion="happy", confidence="0.75", all_scores={"happy": "0.9"})
        assert isinstance(r.confidence, float) and r.confidence == 0.75
        assert r.all_scores["happy"] == 0.9

    def test_valores_invalidos_viram_padrao_seguro(self):
        r = EmotionResult(emotion="x", confidence="abc", all_scores=None)
        assert r.confidence == 0.0
        assert r.all_scores == {}

    def test_unknown_e_abstencao_explicita(self):
        r = EmotionResult(
            emotion="unknown",
            confidence=0.0,
            all_scores={},
            face_detected=False,
            signal_status="no_face",
        )
        assert r.emotion == "unknown"
        assert r.signal_status == "no_face"


class TestQualityGate:
    def test_frame_escuro_e_recusado(self):
        frame = np.zeros((120, 160, 3), dtype=np.uint8)
        result = quality.compute_face_quality(
            frame,
            ActionUnits(),
            (30, 20, 100, 90),
        )
        assert result["accepted"] is False
        assert "too_dark" in result["reasons"]

    def test_rosto_pequeno_e_recusado(self):
        frame = np.full((200, 200, 3), 127, dtype=np.uint8)
        result = quality.compute_face_quality(
            frame,
            ActionUnits(),
            (5, 5, 20, 20),
        )
        assert result["accepted"] is False
        assert "face_too_small" in result["reasons"]


class TestTemporalTracker:
    def test_segundo_frame_estavel_define_metadados_sem_erro(self):
        tracker = TemporalTracker()
        session_id = "sessao-estavel"

        first = EmotionResult(
            emotion="happy",
            confidence=0.8,
            all_scores={"happy": 0.8, "neutral": 0.2},
        )
        tracker.apply_smoothing(first, session_id)

        second = EmotionResult(
            emotion="happy",
            confidence=0.85,
            all_scores={"happy": 0.85, "neutral": 0.15},
        )
        result = tracker.apply_smoothing(second, session_id)

        assert result.emotion == "happy"
        assert result.emotion_variant
        assert result.emotion_zone
        assert result.support_tip

    def test_um_frame_divergente_nao_troca_estado(self):
        tracker = TemporalTracker()
        session_id = "sessao-outlier"
        state = tracker.get_or_create(session_id)
        state.last_emotion = "happy"
        state.scores_ema = {"happy": 0.8, "angry": 0.1, "neutral": 0.1}

        outlier = EmotionResult(
            emotion="angry",
            confidence=0.8,
            all_scores={"angry": 0.8, "happy": 0.1, "neutral": 0.1},
        )
        result = tracker.apply_smoothing(outlier, session_id)

        assert result.emotion == "happy"
