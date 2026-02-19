#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAUNCH_SCRIPT="$SCRIPT_DIR/launch_aumonitor.sh"
APP_NAME="AuMonitor.app"
TMP_SCRIPT="$(mktemp "${TMPDIR:-/tmp}/aumonitor_launcher.XXXXXX.applescript")"

if [[ ! -x "$LAUNCH_SCRIPT" ]]; then
  chmod +x "$LAUNCH_SCRIPT"
fi

cat >"$TMP_SCRIPT" <<EOF
on run
  do shell script quoted form of "$LAUNCH_SCRIPT"
end run
EOF

install_to() {
  local target_path="$1"
  rm -rf "$target_path"
  osacompile -o "$target_path" "$TMP_SCRIPT" >/dev/null
}

PRIMARY_PATH="/Applications/$APP_NAME"
FALLBACK_PATH="$HOME/Applications/$APP_NAME"
INSTALLED_PATH=""

if install_to "$PRIMARY_PATH" 2>/dev/null; then
  INSTALLED_PATH="$PRIMARY_PATH"
else
  mkdir -p "$HOME/Applications"
  install_to "$FALLBACK_PATH"
  INSTALLED_PATH="$FALLBACK_PATH"
fi

rm -f "$TMP_SCRIPT"
printf '%s\n' "$INSTALLED_PATH"
