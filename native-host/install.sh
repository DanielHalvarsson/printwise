#!/usr/bin/env bash
# PrintWise Native Messaging Host Installer
# Run this from WSL after loading the extension in Chrome.
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BOLD}$*${NC}"; }
success() { echo -e "${GREEN}✓ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $*${NC}"; }
fail()    { echo -e "${RED}✗ $*${NC}"; exit 1; }

HOST_NAME="com.printwise.native_host"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
info "PrintWise Native Messaging Host Installer"
echo "----------------------------------------"
echo ""

# ── Prerequisites ──────────────────────────────────────────────────────────────

info "Checking prerequisites..."

if ! command -v python3 &>/dev/null; then
    fail "python3 not found in PATH"
fi
success "python3 found: $(python3 --version)"

CLAUDE_BIN=$(command -v claude 2>/dev/null \
    || [[ -x "$HOME/.local/bin/claude" ]] && echo "$HOME/.local/bin/claude" \
    || true)
if [[ -z "$CLAUDE_BIN" ]]; then
    fail "Claude CLI not found. Install it: npm install -g @anthropic-ai/claude-code"
fi
success "Claude CLI found: $($CLAUDE_BIN --version 2>/dev/null | head -1)"

REG_EXE="/mnt/c/Windows/System32/reg.exe"
if [[ ! -f "$REG_EXE" ]]; then
    fail "reg.exe not found — are you running inside WSL with Windows Chrome?"
fi
success "reg.exe accessible (Windows Chrome detected)"

# ── Detect environment ─────────────────────────────────────────────────────────

WSL_LINUX_USER="$(whoami)"
WIN_USER="$(/mnt/c/Windows/System32/cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r\n')"

if [[ -z "$WIN_USER" ]]; then
    fail "Could not determine Windows username"
fi

# Detect WSL distro name from os-release
WSL_DISTRO="$(grep '^PRETTY_NAME' /etc/os-release 2>/dev/null | cut -d'"' -f2 | awk '{print $1}')"
WSL_DISTRO="${WSL_DISTRO:-Ubuntu}"  # sensible fallback

success "WSL user: $WSL_LINUX_USER  |  Windows user: $WIN_USER  |  Distro: $WSL_DISTRO"

WIN_INSTALL_DIR="/mnt/c/Users/$WIN_USER/AppData/Local/PrintWise/native-host"
WIN_INSTALL_DIR_WIN="C:\\Users\\$WIN_USER\\AppData\\Local\\PrintWise\\native-host"

# ── Extension ID ───────────────────────────────────────────────────────────────

echo ""
info "Extension ID required"
echo ""
echo "  1. Open Chrome and go to: chrome://extensions"
echo "  2. Find PrintWise in the list"
echo "  3. Copy the ID shown under the extension name (32 lowercase letters)"
echo ""
printf "Paste your extension ID here: "
read -r EXTENSION_ID

EXTENSION_ID="${EXTENSION_ID// /}"  # strip spaces
if [[ ! "$EXTENSION_ID" =~ ^[a-z]{32}$ ]]; then
    fail "Invalid extension ID '$EXTENSION_ID' — expected 32 lowercase letters"
fi
success "Extension ID: $EXTENSION_ID"

# ── Create Windows install directory ───────────────────────────────────────────

echo ""
info "Creating install directory..."
mkdir -p "$WIN_INSTALL_DIR"
success "Created $WIN_INSTALL_DIR"

# ── Write the batch launcher ───────────────────────────────────────────────────

BAT_PATH="$WIN_INSTALL_DIR/printwise_host.bat"
BAT_WIN_PATH="${WIN_INSTALL_DIR_WIN}\\printwise_host.bat"

cat > "$BAT_PATH" <<BATEOF
@echo off
wsl.exe -d ${WSL_DISTRO} -u ${WSL_LINUX_USER} -- python3 ${SCRIPT_DIR}/printwise_host.py
BATEOF
success "Wrote batch launcher → $BAT_PATH"

# ── Write the Windows native messaging manifest ────────────────────────────────

MANIFEST_PATH="$WIN_INSTALL_DIR/${HOST_NAME}.json"
MANIFEST_WIN_PATH="${WIN_INSTALL_DIR_WIN}\\${HOST_NAME}.json"

# Escape backslashes for JSON
BAT_WIN_PATH_JSON="${BAT_WIN_PATH//\\/\\\\}"

cat > "$MANIFEST_PATH" <<MANIFEST
{
  "name": "${HOST_NAME}",
  "description": "PrintWise Native Messaging Host",
  "path": "${BAT_WIN_PATH_JSON}",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://${EXTENSION_ID}/"
  ]
}
MANIFEST
success "Wrote manifest → $MANIFEST_PATH"

# ── Register in Windows registry ───────────────────────────────────────────────

echo ""
info "Registering with Chrome via Windows registry..."

REG_KEY="HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}"
"$REG_EXE" add "$REG_KEY" /ve /t REG_SZ /d "$MANIFEST_WIN_PATH" /f > /dev/null

success "Registry entry written: $REG_KEY"

# ── Verify ─────────────────────────────────────────────────────────────────────

echo ""
info "Verifying installation..."

READBACK=$("$REG_EXE" query "$REG_KEY" /ve 2>/dev/null | grep -i "REG_SZ" | awk '{print $NF}' || true)
if [[ -n "$READBACK" ]]; then
    success "Registry entry verified"
else
    warn "Could not read back registry entry — may still be OK"
fi

# ── Done ───────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}Installation complete!${NC}"
echo ""
echo "  Reload the PrintWise extension in Chrome (chrome://extensions → reload icon)"
echo "  then click Extract on any page."
echo ""
echo "  Debug log (if anything goes wrong): /tmp/printwise-host.log"
echo ""
