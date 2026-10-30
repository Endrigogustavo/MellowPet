"""Crise em 3ª pessoa (A1): o cuidador fala da OUTRA pessoa.

Os casos ficam em fixtures/crisis_cases.json, lidos também por
app/tests/crisis.test.mjs. Um teste extra confere que os padrões de
services/crisis.py e app/src/chat/crisis.ts são literalmente os mesmos.
"""
import json
import re
from pathlib import Path

import pytest

from services import crisis
from services.crisis import detect_crisis

CASES = json.loads((Path(__file__).parent / "fixtures" / "crisis_cases.json").read_text(encoding="utf-8"))
APP_CRISIS = Path(__file__).resolve().parents[2] / "app" / "src" / "chat" / "crisis.ts"


@pytest.mark.parametrize("text", CASES["risk"])
def test_crise_detectada(text):
    assert detect_crisis(text), f"falso negativo: {text!r}"


@pytest.mark.parametrize("text", CASES["safe"])
def test_frase_comum_nao_dispara(text):
    assert not detect_crisis(text), f"falso positivo: {text!r}"


@pytest.mark.skipif(not APP_CRISIS.exists(), reason="app/ fora do checkout (deploy só da API)")
def test_padroes_iguais_ao_app():
    source = APP_CRISIS.read_text(encoding="utf-8")
    block = source.split("const PATTERNS: RegExp[] = [", 1)[1].split("];", 1)[0]
    app_patterns = re.findall(r"^\s*/(.+)/,\s*$", block, flags=re.MULTILINE)
    assert app_patterns == crisis._PATTERNS
