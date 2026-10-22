"""
Ações do app que o Mellow pode sugerir no chat ("function calling").

Em vez da API de ferramentas de cada provedor (três formatos diferentes, e o
modelo do aparelho não tem nenhuma), o modelo termina a resposta com uma
etiqueta [[acao:nome]]. O servidor tira a etiqueta do texto e devolve a ação
num campo próprio; o app mostra um botão e só executa com o toque da pessoa.
Etiqueta desconhecida é descartada — o modelo não inventa ação nova.
"""
import re
from typing import Optional

ACTIONS = {
    "respirar": "começar uma respiração guiada",
    "musica": "abrir as músicas para o momento",
    "checkin": "registrar como a pessoa está (check-in)",
    "ninar": "fazer o jogo de relaxar o rosto e ninar o pet",
    "diario": "ditar um diário por voz",
}

_TAG = re.compile(r"\[\[\s*acao\s*:\s*([a-z_]+)\s*\]\]", re.IGNORECASE)

ACTIONS_RULE = (
    "11. Você pode oferecer uma ação do app quando ajudar de verdade. Para isso, termine a resposta com "
    "UMA etiqueta exatamente assim: "
    + ", ".join(f"[[acao:{name}]] ({desc})" for name, desc in ACTIONS.items())
    + ". No máximo uma por resposta; na maioria das respostas, nenhuma."
)


def split_action(text: str) -> tuple[str, Optional[str]]:
    """Remove as etiquetas e devolve (texto_limpo, primeira_ação_válida)."""
    found = [m.group(1).lower() for m in _TAG.finditer(text)]
    action = next((a for a in found if a in ACTIONS), None)
    clean = _TAG.sub("", text).strip()
    return clean, action
