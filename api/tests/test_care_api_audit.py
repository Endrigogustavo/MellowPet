"""Auditoria da API do cuidador (POST /api/v1/care/chat) pela pilha REAL do main.py.

Complementa test_care_copilot.py (modelo isolado) e test_review_api.py /
test_user_auth.py (rota /chat): aqui tudo passa por CORS, GZip, tamanho,
rate limit, X-API-Key, headers de segurança e JWT do Supabase.

Nenhum teste fala com provedor de IA: o serviço é desligado ou trocado por
falsos em todos os testes (o .env local pode ter chave real).

Os testes que antes eram xfail(strict=True) documentavam bugs (A1-A6 de
docs/ux/problemas-api.md); todos foram corrigidos na Fase 4 e a marcação saiu.
"""
import time

import jwt
import pytest
from fastapi.testclient import TestClient

import config
import main
from routers.care import CARE_CRISIS_REPLY
from services.ai_service import ai_chat_service
from utils import auth

KEY = "chave-audit-care-123"
SECRET = "segredo-audit-care-supabase-com-tamanho-suficiente"
URL = "/api/v1/care/chat"
SUMMARY = {"period": "7 dias", "events": 40, "score": 35, "top_emotion": "sad", "difficult_share": 0.5}


def token(sub="cuidador-1", exp_in=3600, secret=SECRET, aud="authenticated", **extra):
    claims = {"aud": aud, "exp": int(time.time()) + exp_in, **extra}
    if sub is not None:
        claims["sub"] = sub
    return jwt.encode(claims, secret, algorithm="HS256")


class FakeProvider:
    def __init__(self, name="gemini", text=None, exc=None):
        self.name = name
        self.text = text
        self.exc = exc
        self.calls = []

    def complete(self, system, messages, max_tokens):
        self.calls.append({"system": system, "messages": messages, "max_tokens": max_tokens})
        if self.exc:
            raise self.exc
        return self.text

    def stream(self, system, messages, max_tokens):  # pragma: no cover - care não usa stream
        raise AssertionError("care/chat não usa streaming")


def use_provider(monkeypatch, provider):
    monkeypatch.setattr(ai_chat_service, "_providers", [provider])
    monkeypatch.setattr(ai_chat_service, "available", True)
    return provider


@pytest.fixture(autouse=True)
def isolate(monkeypatch):
    """Sem IA real, cota por usuário zerada e pilha de middlewares nova
    (o RateLimitMiddleware do main.app guarda estado entre testes)."""
    monkeypatch.setattr(ai_chat_service, "_providers", [])
    monkeypatch.setattr(ai_chat_service, "available", False)
    monkeypatch.setattr(auth, "_limiter", auth._PerUserLimiter())
    monkeypatch.setattr(auth, "_jwks_client", None)
    monkeypatch.setattr(main.app, "middleware_stack", None)
    monkeypatch.setattr(config.settings, "api_key", KEY)
    monkeypatch.setattr(config.settings, "trust_proxy_headers", False)
    monkeypatch.setattr(config.settings, "supabase_jwt_secret", None)
    monkeypatch.setattr(config.settings, "supabase_url", None)


@pytest.fixture
def api():
    with TestClient(main.app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture
def jwt_on(monkeypatch):
    monkeypatch.setattr(config.settings, "supabase_jwt_secret", SECRET)
    monkeypatch.setattr(config.settings, "ai_requests_per_minute_per_user", 2)


def headers(tok=None, key=KEY):
    h = {}
    if key is not None:
        h["X-API-Key"] = key
    if tok is not None:
        h["Authorization"] = f"Bearer {tok}"
    return h


def assert_security_headers(r):
    assert r.headers.get("x-content-type-options") == "nosniff", r.status_code
    assert r.headers.get("x-frame-options") == "DENY", r.status_code
    assert r.headers.get("referrer-policy") == "no-referrer", r.status_code


# ── API key ──────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("key", [None, "", "errada", KEY + " ", KEY.upper()])
def test_care_sem_chave_ou_chave_errada_401_com_headers(api, key):
    r = api.post(URL, json={"message": "oi"}, headers=headers(key=key))
    assert r.status_code == 401
    assert r.json() == {"error": "Invalid or missing API key"}
    assert KEY not in r.text
    assert_security_headers(r)


def test_care_com_chave_certa_sem_ia_200_fallback(api):
    r = api.post(URL, json={"message": "como puxo assunto?", "summary": SUMMARY}, headers=headers())
    assert r.status_code == 200
    assert r.json() == {"response": None, "provider": "fallback"}
    assert_security_headers(r)
    assert "X-RateLimit-Limit" in r.headers


# ── JWT do Supabase ──────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    "tok",
    [
        None,
        "lixo",
        "",
        token(secret="outro-segredo-qualquer-com-tamanho-ok"),
        token(exp_in=-10),
        token(aud="anon"),
        token(sub=None),
        token(sub=""),
        # alg=none: nunca pode ser aceito.
        jwt.encode({"sub": "x", "aud": "authenticated"}, None, algorithm="none"),
    ],
    ids=["ausente", "lixo", "vazio", "assinatura", "expirado", "aud", "sem-sub", "sub-vazio", "alg-none"],
)
def test_care_jwt_invalido_401_com_headers(api, jwt_on, tok):
    r = api.post(URL, json={"message": "oi"}, headers=headers(tok))
    assert r.status_code == 401, r.text
    assert_security_headers(r)


def test_care_authorization_sem_bearer_401(api, jwt_on):
    r = api.post(URL, json={"message": "oi"}, headers={"X-API-Key": KEY, "Authorization": token()})
    assert r.status_code == 401


def test_care_jwt_valido_mas_sem_chave_continua_401(api, jwt_on):
    """A sessão não substitui a X-API-Key: o middleware barra antes."""
    r = api.post(URL, json={"message": "oi"}, headers=headers(token(), key=None))
    assert r.status_code == 401
    assert r.json()["error"] == "Invalid or missing API key"


def test_care_jwt_valido_200(api, jwt_on):
    r = api.post(URL, json={"message": "oi"}, headers=headers(token()))
    assert r.status_code == 200
    assert r.json()["provider"] == "fallback"


def test_care_jwks_fora_do_ar_da_401_e_nao_500(api, monkeypatch):
    """Projeto com JWKS (SUPABASE_URL) e endpoint inacessível: 401, nunca 500."""
    monkeypatch.setattr(config.settings, "supabase_url", "http://127.0.0.1:9")
    r = api.post(URL, json={"message": "oi"}, headers=headers(token()))
    assert r.status_code == 401
    assert "Traceback" not in r.text


# ── Cota por usuário ─────────────────────────────────────────────────────────
def test_care_cota_por_usuario_429_com_headers_e_nao_afeta_outro(api, jwt_on):
    ana = token("ana-cuidadora")
    codes = [api.post(URL, json={"message": "oi"}, headers=headers(ana)).status_code for _ in range(3)]
    assert codes == [200, 200, 429]
    r = api.post(URL, json={"message": "oi"}, headers=headers(ana))
    assert r.status_code == 429
    assert_security_headers(r)
    assert api.post(URL, json={"message": "oi"}, headers=headers(token("bia"))).status_code == 200


def test_cota_e_compartilhada_entre_chat_e_copiloto(api, jwt_on):
    """Mesmo usuário: /chat e /care/chat gastam a mesma cota de IA."""
    t = token("mesma-pessoa")
    assert api.post("/api/v1/chat/", json={"message": "oi"}, headers=headers(t)).status_code == 200
    assert api.post(URL, json={"message": "oi"}, headers=headers(t)).status_code == 200
    assert api.post(URL, json={"message": "oi"}, headers=headers(t)).status_code == 429


def test_care_crise_tambem_exige_sessao(api, jwt_on):
    r = api.post(URL, json={"message": "meu filho quer morrer"}, headers=headers())
    assert r.status_code == 401


# ── Payloads inválidos (422 pela pilha real, sem eco, sem chamar IA) ─────────
ECHO = "XSEGREDOX"

INVALID = {
    "vazio": {},
    "sem-message": {"summary": SUMMARY},
    "message-null": {"message": None},
    "message-numero": {"message": 123},
    "message-longa": {"message": ECHO + "a" * 2_000},
    "message-so-quebras": {"message": "\n\n\t"},
    "history-9": {"message": "oi", "history": [{"role": "user", "content": "x"}] * 9},
    "history-conteudo-longo": {"message": "oi", "history": [{"role": "user", "content": ECHO + "a" * 2_000}]},
    "history-conteudo-vazio": {"message": "oi", "history": [{"role": "assistant", "content": ""}]},
    "history-role-system": {"message": "oi", "history": [{"role": "system", "content": ECHO}]},
    "history-role-bot": {"message": "oi", "history": [{"role": "bot", "content": "oi"}]},
    "history-extra": {"message": "oi", "history": [{"role": "user", "content": "x", "name": ECHO}]},
    "history-objeto": {"message": "oi", "history": {"role": "user", "content": "x"}},
    "extra-topo": {"message": "oi", "cared_user_id": ECHO},
    "summary-lista": {"message": "oi", "summary": [1, 2]},
    "summary-sem-events": {"message": "oi", "summary": {"score": 50}},
    "events-negativo": {"message": "oi", "summary": {"events": -1}},
    "events-gigante": {"message": "oi", "summary": {"events": 1_000_001}},
    "events-fracionario": {"message": "oi", "summary": {"events": 1.5}},
    "score-101": {"message": "oi", "summary": {"events": 5, "score": 101}},
    "score-negativo": {"message": "oi", "summary": {"events": 5, "score": -1}},
    "score-fracionario": {"message": "oi", "summary": {"events": 5, "score": 35.7}},
    "share-negativo": {"message": "oi", "summary": {"events": 5, "difficult_share": -0.1}},
    "period-livre": {"message": "oi", "summary": {"events": 5, "period": ECHO}},
    "emocao-inventada": {"message": "oi", "summary": {"events": 5, "top_emotion": ECHO}},
    "relacao-inventada": {"message": "oi", "summary": {"events": 5, "relationship": "chefe"}},
    "eventos-individuais": {"message": "oi", "summary": {"events": 5, "events_list": [{"emotion": "sad"}]}},
    "corpo-lista": [{"message": "oi"}],
    "corpo-string": "oi",
}


@pytest.mark.parametrize("payload", list(INVALID.values()), ids=list(INVALID.keys()))
def test_care_payload_invalido_422_sem_eco_e_sem_ia(api, monkeypatch, payload):
    p = use_provider(monkeypatch, FakeProvider(text="nunca"))
    r = api.post(URL, json=payload, headers=headers())
    assert r.status_code == 422, r.text
    assert ECHO not in r.text
    assert r.json()["error"] == "Validation failed"
    assert_security_headers(r)
    assert p.calls == []


@pytest.mark.parametrize(
    "raw",
    [
        b'{"message":"oi","summary":{"events":5,"difficult_share":NaN}}',
        b'{"message":"oi","summary":{"events":5,"difficult_share":Infinity}}',
        b'{"message":"oi","summary":{"events":5,"difficult_share":-Infinity}}',
        b'{"message":"oi","summary":{"events":NaN}}',
        b'{"message":"oi","summary":{"events":5,"score":NaN}}',
        b'{"message": "oi"',  # JSON quebrado
        b"",
        b"null",
    ],
    ids=["share-nan", "share-inf", "share-neg-inf", "events-nan", "score-nan", "json-quebrado", "vazio", "null"],
)
def test_care_json_malformado_ou_nan_422(api, monkeypatch, raw):
    p = use_provider(monkeypatch, FakeProvider(text="nunca"))
    r = api.post(URL, content=raw, headers={**headers(), "Content-Type": "application/json"})
    assert r.status_code == 422, (r.status_code, r.text)
    assert_security_headers(r)
    assert p.calls == []


def test_care_content_type_texto_422(api):
    r = api.post(URL, content=b'{"message":"oi"}', headers={**headers(), "Content-Type": "text/plain"})
    assert r.status_code == 422


def test_care_corpo_acima_do_limite_413_com_headers(api, monkeypatch):
    monkeypatch.setattr(config.settings, "max_request_bytes", 5_000)
    payload = {"message": "oi", "history": [{"role": "user", "content": "a" * 1_999}] * 8}
    r = api.post(URL, json=payload, headers=headers())
    assert r.status_code == 413
    assert_security_headers(r)


def test_care_history_no_limite_e_aceito(api, monkeypatch):
    p = use_provider(monkeypatch, FakeProvider(text="Tente algo leve."))
    history = [{"role": "user" if i % 2 == 0 else "assistant", "content": "é" * 2_000} for i in range(8)]
    r = api.post(URL, json={"message": "ç" * 2_000, "history": history}, headers=headers())
    assert r.status_code == 200, r.text
    assert len(p.calls[0]["messages"]) == 9
    assert p.calls[0]["messages"][-1] == {"role": "user", "content": "ç" * 2_000}


def test_care_content_length_invalido_400(api):
    r = api.post(URL, content=b'{"message":"oi"}', headers={**headers(), "Content-Type": "application/json", "Content-Length": "abc"})
    assert r.status_code == 400


def test_care_metodo_errado_405_e_rota_inexistente_404(api):
    r = api.get(URL, headers=headers())
    assert r.status_code == 405
    assert_security_headers(r)
    assert api.post("/api/v1/care/chat/extra", json={"message": "oi"}, headers=headers()).status_code == 404


def test_care_resumo_com_valores_na_borda_aceito(api, monkeypatch):
    p = use_provider(monkeypatch, FakeProvider(text="ok"))
    summary = {"period": "30 dias", "events": 1_000_000, "score": 0, "top_emotion": "fearful",
               "difficult_share": 1, "relationship": "outro"}
    r = api.post(URL, json={"message": "oi", "summary": summary}, headers=headers())
    assert r.status_code == 200
    system = p.calls[0]["system"]
    assert "(30 dias)" in system and "100% de sinais difíceis" in system and "índice de sinais 0/100" in system


def test_care_resumo_null_e_events_zero_viram_sem_leituras(api, monkeypatch):
    p = use_provider(monkeypatch, FakeProvider(text="ok"))
    api.post(URL, json={"message": "oi", "summary": None}, headers=headers())
    api.post(URL, json={"message": "oi", "summary": {"events": 0, "score": 10, "top_emotion": "sad"}}, headers=headers())
    assert all("sem leituras suficientes" in c["system"] for c in p.calls)
    # events=0 não pode vazar score/emoção enviados junto.
    assert "sad" not in p.calls[1]["system"]


def test_care_chaves_de_format_no_texto_nao_quebram_o_prompt(api, monkeypatch):
    p = use_provider(monkeypatch, FakeProvider(text="ok"))
    msg = "{summary} {period} {0} %s }{"
    r = api.post(URL, json={"message": msg, "history": [{"role": "user", "content": "{x}"}]}, headers=headers())
    assert r.status_code == 200
    assert msg not in p.calls[0]["system"]
    assert p.calls[0]["messages"][-1]["content"] == msg


# ── Crise no texto do cuidador ───────────────────────────────────────────────
@pytest.mark.parametrize(
    "msg",
    [
        "Meu filho disse que QUER MORRER",
        "minha mãe falou em suicídio",
        "ela ameaçou tomar todos os remédios",
        "eu mesmo estou pensando em me matar de tanto cansaço",
    ],
)
def test_care_crise_resposta_fixa_sem_modelo(api, monkeypatch, msg):
    p = use_provider(monkeypatch, FakeProvider(text="nunca"))
    r = api.post(URL, json={"message": msg, "summary": SUMMARY}, headers=headers())
    assert r.status_code == 200
    assert r.json() == {"response": CARE_CRISIS_REPLY, "provider": "crisis"}
    assert "188" in r.json()["response"] and "192" in r.json()["response"]
    assert p.calls == []


@pytest.mark.parametrize(
    "msg",
    [
        "meu filho falou em se matar",
        "ele disse que vai se matar",
        "minha mãe disse que não quer mais viver",
        "descobri que ele anda se cortando",
        "ela disse que ninguém ia sentir a falta dela",
    ],
)
def test_care_crise_em_terceira_pessoa_precisa_disparar(api, monkeypatch, msg):
    p = use_provider(monkeypatch, FakeProvider(text="texto gerado"))
    r = api.post(URL, json={"message": msg}, headers=headers())
    assert r.json()["provider"] == "crisis"
    assert p.calls == []


def test_care_crise_no_historico_recente_tambem_da_resposta_fixa(api, monkeypatch):
    p = use_provider(monkeypatch, FakeProvider(text="texto gerado"))
    history = [{"role": "user", "content": "meu filho disse que quer morrer"},
               {"role": "assistant", "content": CARE_CRISIS_REPLY}]
    r = api.post(URL, json={"message": "e o que eu falo agora?", "history": history}, headers=headers())
    assert r.json()["provider"] == "crisis"
    assert p.calls == []


# ── Ausência / falha da IA ───────────────────────────────────────────────────
@pytest.mark.parametrize(
    "provider",
    [FakeProvider(exc=RuntimeError("429 RESOURCE_EXHAUSTED")), FakeProvider(text=None), FakeProvider(text="")],
    ids=["excecao", "none", "vazio"],
)
def test_care_provedor_falha_devolve_fallback(api, monkeypatch, provider):
    use_provider(monkeypatch, provider)
    r = api.post(URL, json={"message": "oi"}, headers=headers())
    assert r.status_code == 200
    assert r.json() == {"response": None, "provider": "fallback"}


def test_care_provedor_cai_para_o_proximo(api, monkeypatch):
    p1 = FakeProvider("gemini", exc=RuntimeError("quota"))
    p2 = FakeProvider("anthropic", text="  Pergunte como foi o dia.  ")
    monkeypatch.setattr(ai_chat_service, "_providers", [p1, p2])
    monkeypatch.setattr(ai_chat_service, "available", True)
    r = api.post(URL, json={"message": "oi"}, headers=headers())
    assert r.json() == {"response": "Pergunte como foi o dia.", "provider": "anthropic"}
    assert p2.calls[0]["max_tokens"] == 500


def test_care_timeout_da_ia_vira_fallback(api, monkeypatch):
    class Slow(FakeProvider):
        def complete(self, system, messages, max_tokens):
            time.sleep(1.0)
            return "tarde demais"

    monkeypatch.setattr(config.settings, "ai_timeout_seconds", 0.2)
    use_provider(monkeypatch, Slow())
    r = api.post(URL, json={"message": "oi"}, headers=headers())
    assert r.json() == {"response": None, "provider": "fallback"}


def test_care_resposta_so_com_espacos_vira_fallback(api, monkeypatch):
    use_provider(monkeypatch, FakeProvider(text="  \n "))
    r = api.post(URL, json={"message": "oi"}, headers=headers())
    assert r.json()["response"] is None


def _explode(monkeypatch):
    async def boom(*a, **k):
        raise RuntimeError("C:\\segredo\\driver.py linha 42")

    monkeypatch.setattr(ai_chat_service, "available", True)
    monkeypatch.setattr(ai_chat_service, "_complete_async", boom)


def test_care_erro_interno_500_generico_sem_vazar_detalhe(api, monkeypatch):
    _explode(monkeypatch)
    r = api.post(URL, json={"message": "oi"}, headers=headers())
    assert r.status_code == 500
    assert r.json() == {"error": "Internal server error"}
    assert "segredo" not in r.text


def test_care_erro_interno_500_leva_headers_de_seguranca(api, monkeypatch):
    _explode(monkeypatch)
    r = api.post(URL, json={"message": "oi"}, headers=headers())
    assert r.status_code == 500
    assert_security_headers(r)


# ── Contrato com o app (app/src/screens/ChatScreen.tsx + care/presenceClient.ts) ─
def test_care_top_emotion_unknown_vinda_do_resumo_real_e_aceita(api):
    summary = {"period": "7 dias", "events": 12, "score": 50, "top_emotion": "unknown", "difficult_share": 0.1}
    r = api.post(URL, json={"message": "oi", "summary": summary}, headers=headers())
    assert r.status_code == 200, r.text


def test_care_payload_exato_do_app_e_aceito(api):
    """Formato montado por askCopilot(): history com role user/assistant, score null."""
    payload = {
        "message": "como puxo assunto?",
        "history": [{"role": "assistant", "content": "Oi! Sou o copiloto."}, {"role": "user", "content": "oi"}],
        "summary": {"period": "7 dias", "events": 2, "score": None, "top_emotion": "happy", "difficult_share": 0},
    }
    assert api.post(URL, json=payload, headers=headers()).status_code == 200


def test_cors_preflight_aceita_authorization(api):
    r = api.options(
        URL,
        headers={
            "Origin": "https://app.mellowpet.app",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type,x-api-key",
        },
    )
    assert r.status_code == 200, r.text


# ── POST /api/v1/care/weekly (resumo semanal, só agregados) ──────────────────
WEEKLY = "/api/v1/care/weekly"
WEEK = {
    "week_start": "2026-10-26",
    "days": [
        {"day": "2026-10-26", "total": 12, "pleasant": 5, "neutral": 4, "difficult": 3},
        {"day": "2026-10-27", "total": 0, "pleasant": 0, "neutral": 0, "difficult": 0},
        {"day": "2026-10-28", "total": 8, "pleasant": 2, "neutral": 2, "difficult": 2},
    ],
    "open_alerts": 1,
    "relationship": "mãe",
}


def test_weekly_sem_ia_devolve_text_null(api):
    r = api.post(WEEKLY, json=WEEK, headers=headers())
    assert r.status_code == 200
    assert r.json() == {"text": None, "provider": "fallback"}
    assert_security_headers(r)


def test_weekly_prompt_so_com_agregados_e_regras_nao_diagnostico(api, monkeypatch):
    p = use_provider(monkeypatch, FakeProvider(text="  Foi uma semana com sinais variados. Que tal perguntar como ela está?  "))
    r = api.post(WEEKLY, json=WEEK, headers=headers())
    assert r.json() == {"text": "Foi uma semana com sinais variados. Que tal perguntar como ela está?", "provider": "gemini"}
    call = p.calls[0]
    assert call["max_tokens"] == 400
    assert "Sem emojis" in call["system"] and "Nada de diagnóstico" in call["system"]
    content = call["messages"][0]["content"]
    assert "seg 26/10: 12 leituras (agradáveis 5, neutras 4, difíceis 3)" in content
    assert "ter 27/10: sem leituras." in content
    assert "Relação de quem cuida com a pessoa: mãe." in content
    assert "Alertas em aberto: 1." in content
    assert "Total: 20 leituras em 2 de 7 dias; 25% de sinais difíceis." in content


def test_weekly_tira_emojis_e_resposta_vazia_vira_fallback(api, monkeypatch):
    use_provider(monkeypatch, FakeProvider(text="Semana tranquila 😊 ✨"))
    assert api.post(WEEKLY, json=WEEK, headers=headers()).json()["text"] == "Semana tranquila"
    use_provider(monkeypatch, FakeProvider(text=" 🙂 \n"))
    assert api.post(WEEKLY, json=WEEK, headers=headers()).json() == {"text": None, "provider": "fallback"}


def test_weekly_sem_leituras_nao_chama_ia(api, monkeypatch):
    p = use_provider(monkeypatch, FakeProvider(text="nunca"))
    body = {"week_start": "2026-10-26", "days": [], "open_alerts": 0}
    assert api.post(WEEKLY, json=body, headers=headers()).json() == {"text": None, "provider": "fallback"}
    assert p.calls == []


def test_weekly_mesma_auth_e_cota_do_chat(api, jwt_on):
    assert api.post(WEEKLY, json=WEEK, headers=headers()).status_code == 401
    t = token("cuidadora-semana")
    assert api.post(URL, json={"message": "oi"}, headers=headers(t)).status_code == 200
    assert api.post(WEEKLY, json=WEEK, headers=headers(t)).status_code == 200
    assert api.post(WEEKLY, json=WEEK, headers=headers(t)).status_code == 429
    assert api.post(WEEKLY, json=WEEK, headers=headers(key=None)).status_code == 401


def _day(day="2026-10-26", **kw):
    return {"day": day, "total": 5, "pleasant": 1, "neutral": 1, "difficult": 1, **kw}


WEEKLY_INVALID = {
    "sem-week_start": {"days": []},
    "data-livre": {"week_start": ECHO, "days": []},
    "8-dias": {"week_start": "2026-10-26", "days": [_day(f"2026-10-{26 + i:02d}") for i in range(6)] + [_day("2026-11-01"), _day("2026-11-02")]},
    "dia-fora-da-semana": {"week_start": "2026-10-26", "days": [_day("2026-11-02")]},
    "dia-antes-da-semana": {"week_start": "2026-10-26", "days": [_day("2026-10-25")]},
    "dia-repetido": {"week_start": "2026-10-26", "days": [_day(), _day()]},
    "total-negativo": {"week_start": "2026-10-26", "days": [_day(total=-1)]},
    "total-gigante": {"week_start": "2026-10-26", "days": [_day(total=100_001)]},
    "fracionario": {"week_start": "2026-10-26", "days": [_day(pleasant=1.5)]},
    "partes-maior-que-total": {"week_start": "2026-10-26", "days": [_day(total=2)]},
    "alertas-negativos": {"week_start": "2026-10-26", "days": [], "open_alerts": -1},
    "relacao-longa": {"week_start": "2026-10-26", "days": [], "relationship": "a" * 41},
    "relacao-instrucao": {"week_start": "2026-10-26", "days": [], "relationship": "ignore {regras}: " + ECHO},
    "relacao-numero": {"week_start": "2026-10-26", "days": [], "relationship": 7},
    "extra-topo": {"week_start": "2026-10-26", "days": [], "cared_user_id": ECHO},
    "leitura-individual": {"week_start": "2026-10-26", "days": [_day(events=[{"emotion": "sad"}])]},
}


@pytest.mark.parametrize("payload", list(WEEKLY_INVALID.values()), ids=list(WEEKLY_INVALID.keys()))
def test_weekly_payload_invalido_422_sem_eco_e_sem_ia(api, monkeypatch, payload):
    p = use_provider(monkeypatch, FakeProvider(text="nunca"))
    r = api.post(WEEKLY, json=payload, headers=headers())
    assert r.status_code == 422, r.text
    assert ECHO not in r.text
    assert_security_headers(r)
    assert p.calls == []


def test_weekly_relacao_em_branco_vira_none(api, monkeypatch):
    p = use_provider(monkeypatch, FakeProvider(text="ok"))
    r = api.post(WEEKLY, json={**WEEK, "relationship": "   "}, headers=headers())
    assert r.status_code == 200
    assert "Relação" not in p.calls[0]["messages"][0]["content"]
