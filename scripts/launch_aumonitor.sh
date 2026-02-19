#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_URL="http://localhost:5173/"
STATE_DIR="$HOME/Library/Application Support/AuMonitor"
LOG_DIR="$HOME/Library/Logs/AuMonitor"
PID_FILE="$STATE_DIR/dev-server.pid"
LOG_FILE="$LOG_DIR/dev-server.log"

mkdir -p "$STATE_DIR" "$LOG_DIR"

ensure_npm() {
  if command -v npm >/dev/null 2>&1; then
    command -v npm
    return
  fi

  if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    . "$HOME/.nvm/nvm.sh"
    nvm use --silent default >/dev/null 2>&1 || true
  fi

  command -v npm || true
}

is_server_ready() {
  curl -fsS --max-time 1 "$APP_URL" >/dev/null 2>&1
}

start_server() {
  (
    cd "$PROJECT_DIR"
    nohup "$NPM_BIN" run dev >>"$LOG_FILE" 2>&1 &
    echo "$!" >"$PID_FILE"
  )
}

NPM_BIN="$(ensure_npm)"
if [[ -z "$NPM_BIN" ]]; then
  osascript <<EOF
display dialog "npm not found. Install Node.js or configure nvm first." buttons {"OK"} default button "OK" with title "AuMonitor"
EOF
  exit 1
fi

if ! is_server_ready; then
  should_start="true"
  if [[ -f "$PID_FILE" ]]; then
    existing_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" 2>/dev/null; then
      should_start="false"
    else
      rm -f "$PID_FILE"
    fi
  fi

  if [[ "$should_start" == "true" ]]; then
    start_server
  fi

  for _ in {1..25}; do
    if is_server_ready; then
      break
    fi
    sleep 1
  done
fi

if ! is_server_ready; then
  osascript <<EOF
display dialog "Failed to start AuMonitor. Check log: $LOG_FILE" buttons {"OK"} default button "OK" with title "AuMonitor"
EOF
  exit 1
fi

open "$APP_URL"
