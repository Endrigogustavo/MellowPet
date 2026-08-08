"""
Logging estruturado da API.

Duas decisoes que parecem detalhe e nao sao:

  - O stream e forcado a UTF-8. O console do Windows abre em cp1252, e qualquer
    caractere fora dessa tabela (uma seta, um emoji, um nome com acento vindo de
    dados do usuario) derrubava o handler com UnicodeEncodeError no meio de uma
    requisicao. Um log nunca deve conseguir quebrar a aplicacao.
  - `propagate = False` evita a mensagem sair duas vezes quando o uvicorn
    tambem configura o logger raiz.

As mensagens do projeto sao escritas em ASCII: elas vao para arquivos, grep e
agregadores, onde emoji atrapalha a leitura e a busca.
"""
import logging
import os
import sys

_LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"
def _build_handler() -> logging.StreamHandler:
    stream = sys.stdout
    # reconfigure existe em TextIOWrapper (3.7+); em stdout redirecionado para
    # algo sem esse metodo, seguimos com o stream como esta.
    reconfigure = getattr(stream, "reconfigure", None)
    if reconfigure is not None:
        try:
            # errors="replace": um caractere impossivel de codificar vira "?"
            # em vez de levantar excecao dentro do handler.
            reconfigure(encoding="utf-8", errors="replace")
        except (ValueError, OSError):
            pass

    handler = logging.StreamHandler(stream)
    handler.setFormatter(logging.Formatter(_LOG_FORMAT, datefmt=_DATE_FORMAT))
    return handler


def setup_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.addHandler(_build_handler())
        level_name = os.getenv("LOG_LEVEL", "INFO").upper()
        logger.setLevel(getattr(logging, level_name, logging.INFO))
        logger.propagate = False
    return logger
