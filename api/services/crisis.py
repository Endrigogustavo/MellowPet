"""
Detecção de risco antes do LLM — espelho de app/src/chat/crisis.ts.

O app já checa no cliente, mas o servidor não pode confiar nisso: um cliente
antigo, outro app usando a API ou uma mensagem que escapou do filtro local
chegariam direto no modelo. Se a mensagem sugere risco à vida, a resposta é
sempre a mensagem fixa com o CVV — nunca texto gerado.

Deliberadamente sensível: falso positivo mostra um número de apoio a mais;
falso negativo pode custar muito mais.
"""
import re
import unicodedata

_PATTERNS = [
    r"\b(me matar|se matar|me mato|suicid|tirar (a )?minha (propria )?vida|acabar com (a )?minha vida)",
    r"\b(quero|vou|penso em|pensando em) morrer\b",
    # "queria morrer", "quero muito morrer", "tenho vontade de morrer",
    # "eu desejo morrer", "só queria sumir e morrer".
    r"\b(quer\w*|desej\w*|vontade de|pens\w* em)( muito| tanto| so)? morrer\b",
    r"\bsumir e morrer\b",
    r"\bnao (quero|aguento) mais (viver|existir)\b",
    r"\b(me cortar|me machucar|automutila|me ferir)",
    r"\bseria melhor (se eu )?(nao existisse|morrer|sumir)",
    r"\bninguem (ia|iria) sentir (a )?minha falta\b",
    r"\b(overdose|tomar todos os remedios)\b",
]
_COMPILED = [re.compile(p) for p in _PATTERNS]

CRISIS_REPLY = (
    "Obrigado por me contar — isso é sério e você não precisa passar por isso sozinho. "
    "Se puder, ligue agora para o CVV no 188 (24h, gratuito) ou fale com alguém de confiança. "
    'Se estiver em perigo imediato, ligue 192. Toque em "Preciso de ajuda" para chamar sua rede de apoio. '
    "Eu fico aqui com você."
)


def _normalize(text: str) -> str:
    # Sem acento e em minúsculas: é assim que se digita no celular.
    decomposed = unicodedata.normalize("NFKD", text.lower())
    plain = "".join(c for c in decomposed if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", plain)


def detect_crisis(message: str) -> bool:
    text = _normalize(message)
    return any(p.search(text) for p in _COMPILED)
