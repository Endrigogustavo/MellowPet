"""
Care Router — copiloto de conversa para cuidadores.

Recebe a pergunta do cuidador e SÓ o resumo agregado que o próprio app já
mostra (índice, sinal mais frequente, tendência). Nunca eventos individuais,
textos de check-in ou conversa da pessoa acompanhada.
"""
import re
from datetime import date, timedelta
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from services.ai_service import ai_chat_service
from services.crisis import detect_crisis
from utils.auth import ai_user

router = APIRouter()

# "unknown" é um valor válido do app (câmera sem leitura clara) e pode ser o
# mais frequente da distribuição de care_dashboard_summary; recusar dava 422 e
# o copiloto caía calado nas respostas prontas.
KnownEmotion = Literal["happy", "sad", "angry", "neutral", "surprised", "disgusted", "fearful", "unknown"]

CARE_SYSTEM = """Você é o copiloto de cuidado do MellowPet. Ajuda quem cuida de alguém (pai, mãe,
parceiro, amigo) a puxar conversas respeitosas e a cuidar de si.

Regras:
1. Português do Brasil, acolhedor e prático, no máximo 5 frases. Sem emojis.
2. Dê roteiros concretos de conversa (frases que a pessoa pode dizer) quando pedirem.
3. O resumo abaixo é agregado e é inferência de expressão facial, NÃO o que a pessoa sente.
   Nunca diga que a pessoa "está" triste/ansiosa; fale em "sinais" e sugira perguntar.
4. Nada de diagnóstico, nada de vigilância, nada de checar o celular da pessoa escondido.
5. Risco à vida, autolesão ou violência: oriente ligar 192 (SAMU) ou 188 (CVV) e não deixar
   a pessoa sozinha.
6. Lembre que o cuidador também precisa de pausa quando ele parecer sobrecarregado.

Resumo agregado do período ({period}): {summary}
"""

CARE_CRISIS_REPLY = (
    "Se houver risco imediato, ligue 192 (SAMU) e fique por perto da pessoa. "
    "O CVV atende 24h no 188, inclusive quem está cuidando. Depois, procure um "
    "profissional de saúde mental para orientar os próximos passos."
)


class CareSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    period: Literal["24 horas", "7 dias", "30 dias"] = "7 dias"
    events: int = Field(ge=0, le=1_000_000)
    score: Optional[int] = Field(default=None, ge=0, le=100)
    top_emotion: Optional[KnownEmotion] = None
    difficult_share: float = Field(default=0, ge=0, le=1, allow_inf_nan=False)
    relationship: Optional[Literal["mae", "pai", "parceiro", "filho", "amigo", "outro"]] = None


class CareTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2_000)


class CareChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=2_000)
    history: list[CareTurn] = Field(default_factory=list, max_length=8)
    summary: Optional[CareSummary] = None

    @field_validator("message")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("message must not be blank")
        return value

    def crisis_text(self) -> str:
        """Combina a mensagem atual com as últimas 2 mensagens do usuário no
        histórico — crise mencionada no contexto recente também recebe a
        orientação fixa imediata."""
        recent_user = [m.content for m in self.history if m.role == "user"][-2:]
        return " ".join([self.message, *recent_user])


def describe(summary: Optional[CareSummary]) -> str:
    if summary is None or summary.events == 0:
        return "sem leituras suficientes no período."
    parts = [f"{summary.events} leituras"]
    if summary.score is not None:
        parts.append(f"índice de sinais {summary.score}/100 (abaixo de 40 pede atenção)")
    if summary.top_emotion == "unknown":
        parts.append("sinal mais frequente: sem leitura clara (a câmera não reconheceu bem o rosto)")
    elif summary.top_emotion:
        parts.append(f"sinal mais frequente: {summary.top_emotion}")
    parts.append(f"{round(summary.difficult_share * 100)}% de sinais difíceis")
    if summary.relationship:
        parts.append(f"relação com quem cuida: {summary.relationship}")
    return "; ".join(parts) + "."


@router.post("/chat", summary="Conversation copilot for caregivers (aggregated data only)")
async def care_chat(request: CareChatRequest, _user: Optional[str] = Depends(ai_user)):
    if detect_crisis(request.crisis_text()):
        return {"response": CARE_CRISIS_REPLY, "provider": "crisis"}
    if not ai_chat_service.available:
        return {"response": None, "provider": "fallback"}
    period = request.summary.period if request.summary else "7 dias"
    system = CARE_SYSTEM.format(period=period, summary=describe(request.summary))
    messages = [m.model_dump() for m in request.history[-8:]] + [{"role": "user", "content": request.message}]
    text, provider = await ai_chat_service._complete_async(system, messages, max_tokens=500)
    # strip ANTES de testar: só espaços virava response="" e o app mostrava um
    # balão vazio (ele só troca null pelas respostas prontas).
    clean = (text or "").strip()
    if not clean:
        return {"response": None, "provider": "fallback"}
    return {"response": clean, "provider": provider}


# ── Resumo semanal (POST /care/weekly) ──────────────────────────────────────
# Recebe só os agregados diários que o app já mostra. Nada de leituras
# individuais, nomes ou textos da pessoa. Sem IA → text null, e o app usa o
# resumo por regras. O texto é guardado no aparelho, não no banco.

WEEKLY_SYSTEM = """Você escreve o resumo semanal do MellowPet para quem cuida de alguém.

Regras:
1. Português do Brasil, tom calmo e acolhedor, de 3 a 5 frases em texto corrido.
   Sem emojis, sem listas, sem títulos, sem markdown.
2. Os números são contagens agregadas de leituras de expressão facial, NÃO o que a pessoa
   sente. Fale em "sinais" e "leituras"; nunca diga que a pessoa "está" triste, ansiosa ou
   deprimida.
3. Nada de diagnóstico, nome de transtorno, remédio, previsão ou nota. Não sugira vigiar,
   checar o celular, cobrar explicações nem comparar com outras pessoas.
4. Poucas leituras dizem pouco: com volume baixo, diga isso em vez de tirar conclusões.
5. Se houver alertas em aberto, mencione com calma que vale olhar no app, sem alarme.
6. Termine com uma sugestão gentil e concreta de contato (uma pergunta aberta, um convite
   simples) e, se fizer sentido, lembre quem cuida de também cuidar de si.
"""

# Relação é texto curto escrito pelo cuidador ("mãe", "meu avô"): só letras,
# espaço, hífen e apóstrofo — nada que pareça instrução para o modelo.
_RELATIONSHIP_RE = re.compile(r"^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$")
_WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]
# Emojis e pictogramas: o prompt pede sem emojis, e a saída é limpa de novo.
_EMOJI_RE = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0000FE0F\U0000200D\U00002B00-\U00002BFF\U0001F1E6-\U0001F1FF]"
)

Count = Annotated[int, Field(ge=0, le=100_000)]


class DayIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    day: date
    total: Count
    pleasant: Count
    neutral: Count
    difficult: Count

    @model_validator(mode="after")
    def _parts_fit_total(self) -> "DayIn":
        # "unknown" não entra em nenhum dos três, então a soma pode ser menor.
        if self.pleasant + self.neutral + self.difficult > self.total:
            raise ValueError("pleasant + neutral + difficult must not exceed total")
        return self


class WeeklySummaryIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    week_start: date
    days: list[DayIn] = Field(default_factory=list, max_length=7)
    open_alerts: int = Field(default=0, ge=0, le=10_000)
    relationship: Optional[str] = Field(default=None, max_length=40)

    @field_validator("relationship")
    @classmethod
    def _short_relationship(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        clean = " ".join(value.split())
        if not clean:
            return None
        if not _RELATIONSHIP_RE.match(clean):
            raise ValueError("relationship must contain only letters")
        return clean

    @model_validator(mode="after")
    def _days_inside_week(self) -> "WeeklySummaryIn":
        end = self.week_start + timedelta(days=6)
        seen: set[date] = set()
        for d in self.days:
            if not (self.week_start <= d.day <= end):
                raise ValueError("day outside the week")
            if d.day in seen:
                raise ValueError("duplicated day")
            seen.add(d.day)
        return self


def describe_week(payload: WeeklySummaryIn) -> str:
    end = payload.week_start + timedelta(days=6)
    lines = [f"Semana de {payload.week_start:%d/%m} a {end:%d/%m}."]
    if payload.relationship:
        lines.append(f"Relação de quem cuida com a pessoa: {payload.relationship}.")
    for d in sorted(payload.days, key=lambda x: x.day):
        if d.total == 0:
            lines.append(f"{_WEEKDAYS[d.day.weekday()]} {d.day:%d/%m}: sem leituras.")
        else:
            lines.append(
                f"{_WEEKDAYS[d.day.weekday()]} {d.day:%d/%m}: {d.total} leituras "
                f"(agradáveis {d.pleasant}, neutras {d.neutral}, difíceis {d.difficult})."
            )
    total = sum(d.total for d in payload.days)
    difficult = sum(d.difficult for d in payload.days)
    days_with_data = sum(1 for d in payload.days if d.total > 0)
    lines.append(
        f"Total: {total} leituras em {days_with_data} de 7 dias; "
        f"{round(difficult / total * 100) if total else 0}% de sinais difíceis."
    )
    lines.append(f"Alertas em aberto: {payload.open_alerts}.")
    return "\n".join(lines)


def clean_weekly_text(text: Optional[str]) -> Optional[str]:
    clean = _EMOJI_RE.sub("", text or "")
    clean = re.sub(r"[ \t]+", " ", clean).strip()
    return clean or None


@router.post("/weekly", summary="Weekly caregiver summary from daily aggregates only")
async def care_weekly(request: WeeklySummaryIn, _user: Optional[str] = Depends(ai_user)):
    # Sem leitura nenhuma não há o que resumir: não gasta IA, o app usa as regras.
    if not ai_chat_service.available or not any(d.total for d in request.days):
        return {"text": None, "provider": "fallback"}
    messages = [{"role": "user", "content": describe_week(request)}]
    text, provider = await ai_chat_service._complete_async(WEEKLY_SYSTEM, messages, max_tokens=400)
    clean = clean_weekly_text(text)
    if not clean:
        return {"text": None, "provider": "fallback"}
    return {"text": clean, "provider": provider}
