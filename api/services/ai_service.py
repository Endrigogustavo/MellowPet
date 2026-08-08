"""
Camada de IA conversacional do Mellow.

Suporta Gemini, Anthropic e OpenAI atras de uma interface unica. Duas decisoes
importam para producao:

  - Os SDKs sao importados sob demanda, dentro do provedor escolhido. Antes o
    modulo importava `openai` e `anthropic` no topo, entao a API inteira se
    recusava a subir se um desses pacotes faltasse — mesmo sem estar em uso.
  - Ha cadeia de fallback: se o provedor preferido falhar (cota, rede, chave
    invalida), tenta o proximo configurado e, por ultimo, responde offline. O
    chat de apoio emocional nao pode ficar mudo por causa de um 429.

Nenhuma chave aparece no codigo: todas vem do ambiente, via config.
"""

from __future__ import annotations

import os
from typing import Optional, Protocol

from config import settings
from utils.logger import setup_logger

logger = setup_logger(__name__)

SYSTEM_PROMPT = """Você é o Mellow, o bichinho virtual do MellowPet — empático e fofo, cuida do bem-estar emocional do usuário.

Você acabou de detectar a emoção do usuário através da câmera: {emotion} (confiança: {confidence}%).

Suas regras:
1. Seja SEMPRE gentil, acolhedor e não-julgador
2. Responda em português brasileiro, de forma natural e calorosa
3. Use emojis com moderação (1-2 por resposta)
4. Adapte o tom à emoção detectada:
   - Feliz: celebre junto, energia positiva
   - Triste: acolhimento, validação emocional, sugestão de autocuidado
   - Ansioso/com medo: técnicas de respiração, ancoragem no presente
   - Raiva: ajude a processar, sem minimizar
   - Neutro: leve, curioso, engajante
5. Respostas curtas (máximo 3 frases) e conversacionais
6. Use a emoção detectada só como contexto, sem soar como relatório técnico
7. Quando fizer sentido, faça uma pergunta curta de continuidade em vez de repetir o estado atual
8. Nunca dê diagnósticos médicos
9. Em casos graves, sugira ajuda profissional com carinho
10. Você tem personalidade de pet: fofo, leal, sempre presente
"""

INSIGHT_PROMPT = """Analise o seguinte resumo emocional do usuário {period} e gere um insight
empático, construtivo e personalizado em 2-3 frases. Seja positivo e encorajador.

Dados: {summary}

Foque em: padrões observados, sugestões práticas, pontos positivos."""


class Provider(Protocol):
    """Contrato minimo de um provedor de texto."""

    name: str

    def complete(self, system: str, messages: list[dict], max_tokens: int) -> str: ...


class GeminiProvider:
    """Google Gemini. Preferido por padrao."""

    name = "gemini"

    def __init__(self, api_key: str, model: Optional[str] = None):
        # Import tardio: o pacote so e exigido de quem realmente usa Gemini.
        from google import genai

        self._client = genai.Client(api_key=api_key)
        self._model = model or os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    def complete(self, system: str, messages: list[dict], max_tokens: int) -> str:
        from google.genai import types

        # O Gemini usa "model" no lugar de "assistant" e recebe a instrucao de
        # sistema fora da lista de mensagens.
        contents = [
            types.Content(
                role="model" if m["role"] == "assistant" else "user",
                parts=[types.Part.from_text(text=m["content"])],
            )
            for m in messages
        ]
        response = self._client.models.generate_content(
            model=self._model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system,
                max_output_tokens=max_tokens,
                temperature=0.8,
            ),
        )
        return (response.text or "").strip()


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, api_key: str, model: Optional[str] = None):
        import anthropic

        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model or os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")

    def complete(self, system: str, messages: list[dict], max_tokens: int) -> str:
        response = self._client.messages.create(
            model=self._model,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        )
        return response.content[0].text.strip()


class OpenAIProvider:
    name = "openai"

    def __init__(self, api_key: str, model: Optional[str] = None):
        from openai import OpenAI

        self._client = OpenAI(api_key=api_key)
        self._model = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    def complete(self, system: str, messages: list[dict], max_tokens: int) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "system", "content": system}] + messages,
            max_tokens=max_tokens,
            temperature=0.8,
        )
        return (response.choices[0].message.content or "").strip()


# Ordem de preferencia. AI_PROVIDER move um provedor para a frente da fila.
_BUILDERS = {
    "gemini": (GeminiProvider, "gemini_api_key"),
    "anthropic": (AnthropicProvider, "anthropic_api_key"),
    "openai": (OpenAIProvider, "openai_api_key"),
}
_DEFAULT_ORDER = ("gemini", "anthropic", "openai")


class AIChatService:
    """Fachada de chat/insight com cadeia de provedores e fallback offline."""

    def __init__(self):
        self._providers: list[Provider] = self._build_chain()
        self.available = bool(self._providers)
        self.provider = self._providers[0].name if self._providers else "fallback"

        if self.available:
            logger.info(
                "IA disponivel | ordem=%s",
                " -> ".join(p.name for p in self._providers),
            )
        else:
            logger.warning(
                "Nenhuma chave de IA configurada (GEMINI_API_KEY/ANTHROPIC_API_KEY/"
                "OPENAI_API_KEY) - chat em modo offline"
            )

    def _build_chain(self) -> list[Provider]:
        """Instancia os provedores que tem chave, na ordem de preferencia."""
        preferred = (settings.ai_provider or "").strip().lower()
        order = list(_DEFAULT_ORDER)
        if preferred in order:
            order.remove(preferred)
            order.insert(0, preferred)

        chain: list[Provider] = []
        for name in order:
            builder, key_field = _BUILDERS[name]
            api_key = getattr(settings, key_field, None)
            if not api_key:
                continue
            try:
                chain.append(builder(api_key))
            except ImportError as exc:
                logger.warning(
                    "Chave de %s definida mas o SDK nao esta instalado (%s)", name, exc
                )
            except Exception as exc:
                logger.warning("Nao foi possivel iniciar o provedor %s: %s", name, exc)
        return chain

    def _complete(self, system: str, messages: list[dict], max_tokens: int) -> tuple[Optional[str], str]:
        """Tenta cada provedor em ordem. Devolve (texto, nome_do_provedor)."""
        for provider in self._providers:
            try:
                text = provider.complete(system, messages, max_tokens)
                if text:
                    return text, provider.name
                logger.warning("Provedor %s devolveu resposta vazia", provider.name)
            except Exception as exc:
                # Cota estourada, rede fora, chave revogada: cai para o proximo.
                logger.warning("Provedor %s falhou: %s", provider.name, exc)
        return None, "fallback"

    async def generate_response(
        self,
        user_message: str,
        emotion: str,
        confidence: float,
        conversation_history: Optional[list] = None,
    ) -> tuple[str, str]:
        if not self.available:
            return self._fallback_response(emotion), "fallback"

        system = SYSTEM_PROMPT.format(emotion=emotion, confidence=round(confidence * 100, 1))
        messages = [
            {"role": m["role"], "content": m["content"]}
            for m in (conversation_history or [])[-12:]
        ]
        messages.append({"role": "user", "content": user_message})

        text, provider = self._complete(system, messages, max_tokens=256)
        if text is None:
            return self._fallback_response(emotion), "fallback"
        return text, provider

    async def generate_insight(
        self,
        emotion_summary: dict,
        period: str = "hoje",
    ) -> tuple[str, str]:
        """Insight comportamental a partir do historico emocional."""
        offline = "Continue acompanhando suas emoções — o autoconhecimento é o primeiro passo! 🌱"
        if not self.available:
            return "Análise de padrões emocionais disponível com IA configurada.", "fallback"

        prompt = INSIGHT_PROMPT.format(period=period, summary=emotion_summary)
        text, provider = self._complete(
            system="Você é um analista empático de bem-estar emocional.",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
        )
        if text is None:
            return offline, "fallback"
        return text, provider

    def _fallback_response(self, emotion: str) -> str:
        """Respostas offline. Curtas e acolhedoras, sem prometer o que nao ha."""
        fallbacks = {
            "happy": "Que energia incrível você está transmitindo! O Mellow está adorando! 🌟",
            "sad": "Estou aqui com você. Momentos difíceis passam, e você não está sozinho(a) 💙",
            "angry": "Respira fundo comigo. Um passo de cada vez, tudo vai se resolver 🌿",
            "anxious": "Você está seguro(a) agora. Vamos respirar juntos: inspira 4s, expira 4s 💛",
            "fearful": "Você está em segurança agora. Estou aqui com você 💛",
            "neutral": "Como você está se sentindo hoje? Estou aqui para conversar! 🐾",
            "surprised": "Uau! O que aconteceu? Conta pra mim! 😲",
            "disgusted": "Caramba! Parece que algo não foi legal. Quer conversar? 💬",
        }
        return fallbacks.get(emotion, "Estou aqui com você 🐾")


ai_chat_service = AIChatService()
