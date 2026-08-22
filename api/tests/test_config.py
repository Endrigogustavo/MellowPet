"""
Testes da configuracao — foco na trava que impede subir inseguro."""
import pytest

from config import Settings


def make(**kwargs) -> Settings:
    # _env_file=None isola o teste do .env da maquina.
    return Settings(_env_file=None, **kwargs)


class TestCors:
    def test_lista_separada_por_virgula_com_espacos(self):
        s = make(cors_origins="https://a.app, https://b.app ")
        assert s.cors_origin_list == ["https://a.app", "https://b.app"]

    def test_detecta_wildcard(self):
        assert make(cors_origins="*").allow_wildcard_cors is True
        assert make(cors_origins="https://a.app").allow_wildcard_cors is False


class TestTravaDeProducao:
    """
    Em producao a config insegura precisa impedir o boot, nao so avisar."""
    def test_cors_aberto_e_sem_chave_levanta(self):
        with pytest.raises(RuntimeError) as exc:
            make(app_env="production", cors_origins="*").validate_for_runtime()
        assert "CORS_ORIGINS" in str(exc.value)
        assert "API_KEY" in str(exc.value)

    def test_docs_ligado_em_producao_levanta(self):
        with pytest.raises(RuntimeError, match="ENABLE_DOCS"):
            make(
                app_env="production",
                cors_origins="https://app.mellowpet.app",
                api_key="k" * 32,
                enable_docs=True,
            ).validate_for_runtime()

    def test_debug_ligado_em_producao_levanta(self):
        with pytest.raises(RuntimeError, match="DEBUG"):
            make(
                app_env="production",
                cors_origins="https://app.mellowpet.app",
                api_key="k" * 32,
                enable_docs=False,
                debug=True,
            ).validate_for_runtime()

    def test_producao_bem_configurada_passa(self):
        s = make(
            app_env="production",
            cors_origins="https://app.mellowpet.app",
            api_key="k" * 32,
            enable_docs=False,
            debug=False,
        )
        assert s.validate_for_runtime() == []
        assert s.is_production is True

    def test_dev_inseguro_apenas_avisa(self):
        warnings = make(app_env="development", cors_origins="*").validate_for_runtime()
        assert warnings, "dev deveria gerar avisos"
        # E, principalmente, nao levantar.
