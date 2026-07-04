#!/bin/bash
set -Eeuo pipefail

# 基于脚本位置定位项目根目录（scripts/ 的上一级）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

PORT=5000

kill_port_if_listening() {
    local pids
    pids=$(ss -H -lntp 2>/dev/null | awk -v port="${PORT}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | grep -v 'pid=0' | cut -d= -f2 | paste -sd' ' - || true)
    if [[ -z "${pids}" ]]; then
      echo "Port ${PORT} is free."
      return
    fi
    echo "Port ${PORT} in use by PIDs: ${pids} (SIGKILL)"
    echo "${pids}" | xargs -I {} kill -9 {} 2>/dev/null || true
    sleep 1
    pids=$(ss -H -lntp 2>/dev/null | awk -v port="${PORT}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | grep -v 'pid=0' | cut -d= -f2 | paste -sd' ' - || true)
    if [[ -n "${pids}" ]]; then
      echo "Warning: port ${PORT} still busy after SIGKILL, PIDs: ${pids}"
    else
      echo "Port ${PORT} cleared."
    fi
}

echo "Clearing port ${PORT} before start."
kill_port_if_listening
echo "Starting Next.js dev server on 0.0.0.0:${PORT}..."

export HOSTNAME=0.0.0.0
export PORT=${PORT}
export NODE_ENV=development
exec pnpm tsx watch src/server.ts
