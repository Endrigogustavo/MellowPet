#!/usr/bin/env bash
# Script para iniciar o servidor Expo Web e abrir a janela flutuante estilo Celular (iPhone)

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT=8081
URL="http://localhost:${PORT}"
PREVIEW_PROFILE="/tmp/mellowpet-phone-preview"

echo "📱 Iniciando Preview Celular Virtual para MellowPet..."

# Iniciar o Expo Web se não estiver rodando
if ! lsof -i :$PORT >/dev/null 2>&1; then
  echo "Subindo servidor Expo com Fast Refresh na porta $PORT..."
  python3 -c "
import pty, subprocess
master, slave = pty.openpty()
subprocess.Popen(
    ['npx', 'expo', 'start', '--web', '--port', '$PORT'],
    cwd='$APP_DIR',
    stdin=slave,
    stdout=open('/tmp/mellowpet-expo.log', 'a'),
    stderr=subprocess.STDOUT,
    close_fds=True
)
"
  
  # Aguardar servidor responder
  echo "Aguardando bundler inicializar..."
  for i in {1..30}; do
    if curl -s "http://localhost:${PORT}" >/dev/null 2>&1; then
      echo "Servidor pronto!"
      break
    fi
    sleep 1
  done
else
  echo "Servidor Expo já está rodando na porta $PORT!"
fi

echo "Abrindo janela virtual do celular..."
# Fecha instância anterior do preview para garantir carregamento limpo e traz a janela para frente via LaunchServices
pkill -f "user-data-dir=${PREVIEW_PROFILE}" >/dev/null 2>&1 || true
rm -rf "${PREVIEW_PROFILE}/Default/Cache" "${PREVIEW_PROFILE}/Default/Code Cache" >/dev/null 2>&1 || true
sleep 0.4

# Abre o Chrome em modo App (sem abas, sem barra de navegação) com dimensões de iPhone moderno (420x900)
open -na "Google Chrome" --args \
  --app="$URL" \
  --window-size=420,900 \
  --user-data-dir="$PREVIEW_PROFILE" \
  --disk-cache-size=1 \
  --no-first-run \
  --no-default-browser-check

echo "Janela do Celular Virtual aberta na sua tela!"
echo "Todas as alterações de código feitas pelo agente serão refletidas em tempo real nesta janela."

