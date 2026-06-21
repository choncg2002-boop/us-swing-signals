#!/bin/sh
set -e

PORT="${PORT:-8080}"
export RUNTIME_DIR="${RUNTIME_DIR:-/data/runtime}"
mkdir -p "$RUNTIME_DIR"

sed "s/__PORT__/${PORT}/g" /etc/nginx/templates/default.conf > /etc/nginx/conf.d/default.conf

uvicorn app.main:app --host 127.0.0.1 --port 8000 &
UVICORN_PID=$!

nginx -g "daemon off;" &
NGINX_PID=$!

shutdown() {
  kill "$UVICORN_PID" "$NGINX_PID" 2>/dev/null || true
  wait "$UVICORN_PID" "$NGINX_PID" 2>/dev/null || true
}

trap shutdown INT TERM

wait -n "$UVICORN_PID" "$NGINX_PID"
shutdown
