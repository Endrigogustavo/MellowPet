#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -x "venv/bin/python" ]]; then
  echo "[MellowPet API] venv nao encontrada. Criando ambiente virtual..."
  python3 -m venv venv
fi

echo "[MellowPet API] Iniciando com Python da venv..."

pick_port() {
  # Respect an explicit port when provided.
  if [[ -n "${MELLOWPET_PORT:-}" ]]; then
    echo "${MELLOWPET_PORT}"
    return 0
  fi

  # Pick the first free port from a preferred list.
  venv/bin/python - <<'PY'
import socket
for port in (8000, 8001, 8002, 8010):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("0.0.0.0", port))
            print(port)
            break
        except OSError:
            continue
PY
}

PORT="$(pick_port)"
if [[ -z "${PORT}" ]]; then
  echo "[MellowPet API] Nenhuma porta livre encontrada (8000, 8001, 8002, 8010)."
  exit 1
fi

echo "[MellowPet API] Usando porta ${PORT}"

# NOTE: On some Linux stacks, uvicorn extras (uvloop/httptools) and reload watchers can cause segfaults.
# Use the safest protocol/loop combination by default.
UVICORN_ARGS=(main:app --env-file .env --host 0.0.0.0 --port "${PORT}" --loop asyncio --http h11)

if [[ "${MELLOWPET_RELOAD:-1}" == "1" ]]; then
  UVICORN_ARGS+=(--reload)
fi

exec venv/bin/python -m uvicorn "${UVICORN_ARGS[@]}"
