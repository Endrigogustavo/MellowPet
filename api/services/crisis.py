"""
Detecção de risco antes do LLM — espelho de app/src/chat/crisis.ts.

O app já checa no cliente, mas o servidor não pode confiar nisso: um cliente
antigo, outro app usando a API ou uma mensagem que escapou do filtro local
chegariam direto no modelo. Se a mensagem sugere risco à vida, a resposta é
sempre a mensagem fixa com o CVV — nunca texto gerado.

Deliberadamente sensível: falso positivo mostra um número de apoio a mais;
falso negativo pode custar muito mais.

Os padrões cobrem a 1ª pessoa (quem conversa com o Mellow) e a 3ª pessoa
(o cuidador contando sobre outra pessoa: "ele falou em se matar", "ela não
quer mais viver", "anda se cortando"). O texto é normalizado sem acento antes,
então os padrões são escritos sem acento.
"""
import re
import unicodedata

_PATTERNS = [
    # ── 1ª pessoa ──
    r"\b(me matar|me mato|suicid|tirar (a )?minha (propria )?vida|acabar com (a )?minha vida)",
    r"\b(quero|vou|penso em|pensando em) morrer\b",
    # "queria morrer", "quero muito morrer", "tenho vontade de morrer",
    # "eu desejo morrer", "só queria sumir e morrer". Também cobre a 3ª
    # pessoa "ele quer morrer", "disse que queria morrer".
    r"\b(quer\w*|desej\w*|vontade de|pens\w* em)( muito| tanto| so)? morrer\b",
    r"\bsumir e morrer\b",
    r"\bnao (quero|aguento) mais (viver|existir)\b",
    r"\b(me cortar|me machucar|automutila|me ferir)",
    r"\bseria melhor (se eu )?(nao existisse|morrer|sumir)",
    r"\bninguem (ia|iria) sentir (a )?minha falta\b",
    r"\b(overdose|tomar todos os remedios)\b",
    # ── 3ª pessoa (o cuidador fala de alguém) ──
    # "se matar", "se mata", "se matou", "ameaçou se matar". Ficam de fora as
    # expressões do dia a dia "se matando de trabalhar", "se mata de rir".
    r"\bse (matar|mata|mato|matou|matando|matasse)\b(?! de (rir|trabalhar|estudar|correr))",
    r"\bse (enforcar|enforcou|enforcando|envenenar|envenenou)\b",
    # "anda se cortando", "se corta", "quer se machucar", "tentou se ferir".
    # "se machucou"/"se cortou" sozinhos ficam de fora: em geral é acidente.
    r"\bse (cortar|corta|cortando|cortava)\b",
    r"\bse (machucando|ferindo)\b",
    r"\b(quer|queria|vai|pensa em|pensou em|tentou|tenta|ameacou|ameaca|falou em|fala em) se (machucar|ferir|cortar)\b",
    r"\bnao (quer|queria|aguenta|aguentava) mais (viver|existir)\b",
    r"\bnao (ve|vejo|via) (mais )?sentido (em viver|na vida)\b",
    r"\bfal\w* (em|de|sobre) morrer\b",
    r"\b(tirar|acabar com|por fim (a|na)) (a )?(propria|sua) vida\b",
    r"\btirar a (propria )?vida\b",
    r"\bninguem (ia|iria|vai) sentir (a )?(minha falta|sua falta|falta del[ae])\b",
    r"\bseria melhor se (ele|ela) (nao existisse|morresse|sumisse)\b",
    r"\b(tomou|tomar|tomando|engoliu) (todos os|todas as|um monte de|varios|varias|muitos|muitas) (remedios|comprimidos|pilulas|calmantes)\b",
    r"\b(pular|pulou|se jogar|se jogou) (da|de uma|do|de um) (ponte|janela|predio|sacada|viaduto|varanda)\b",
    r"\bcarta de despedida\b",
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
