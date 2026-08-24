FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# curl entra para o HEALTHCHECK abaixo.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN python -m pip install --upgrade pip \
    && python -m pip install -r requirements.txt

COPY . ./

# Roda como usuario sem privilegio: se a API for comprometida, o processo nao
# tem root dentro do container.
RUN useradd --create-home --uid 10001 mellow \
    && chown -R mellow:mellow /app
USER mellow

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

# Sem --proxy-headers de proposito: quem decide confiar em X-Forwarded-For e a
# variavel TRUST_PROXY_HEADERS, para haver um unico controle. Ligar as duas
# coisas faria o uvicorn aceitar o header de qualquer origem e o rate limit por
# IP viraria contornavel.
CMD ["python", "-m", "uvicorn", "main:app", \
     "--host", "0.0.0.0", "--port", "8000", \
     "--loop", "asyncio", "--http", "h11"]
