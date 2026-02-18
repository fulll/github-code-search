#!/usr/bin/env bash
# install.sh — download and install the latest github-code-search binary.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/fulll/github-code-search/main/install.sh | bash
#
# Environment variables:
#   INSTALL_DIR   destination directory (default: /usr/local/bin)
#   VERSION       specific version tag to install (default: latest)

set -euo pipefail

REPO="fulll/github-code-search"
BINARY_NAME="github-code-search"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
GITHUB_API="https://api.github.com"

# ─── Detect OS ────────────────────────────────────────────────────────────────

case "$(uname -s)" in
  Linux*)   OS="linux" ;;
  Darwin*)  OS="macos" ;;
  MINGW*|MSYS*|CYGWIN*) OS="windows" ;;
  *)
    echo "error: unsupported OS: $(uname -s)" >&2
    exit 1
    ;;
esac

# ─── Detect architecture ──────────────────────────────────────────────────────

MACHINE="$(uname -m)"
case "$MACHINE" in
  x86_64|amd64) ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *)
    echo "error: unsupported architecture: $MACHINE" >&2
    exit 1
    ;;
esac

ARTIFACT="${BINARY_NAME}-${OS}-${ARCH}"
[ "$OS" = "windows" ] && ARTIFACT="${ARTIFACT}.exe"

# ─── Resolve version ──────────────────────────────────────────────────────────

if [ -n "${VERSION:-}" ]; then
  TAG="$VERSION"
else
  echo "Detecting latest release…"
  TAG=$(curl -fsSL "${GITHUB_API}/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' \
    | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')
fi

echo "Installing ${BINARY_NAME} ${TAG} (${OS}/${ARCH})…"

# ─── Download ─────────────────────────────────────────────────────────────────

DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${TAG}/${ARTIFACT}"
TMP="$(mktemp)"
curl -fsSL --progress-bar -o "$TMP" "$DOWNLOAD_URL"
chmod +x "$TMP"

# ─── Install ──────────────────────────────────────────────────────────────────

DEST="${INSTALL_DIR}/${BINARY_NAME}"
if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP" "$DEST"
else
  echo "  (sudo required for ${INSTALL_DIR})"
  sudo mv "$TMP" "$DEST"
fi

echo "✓ ${BINARY_NAME} ${TAG} installed at ${DEST}"
echo ""
echo "  Remember to export your GitHub token:"
echo "    export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx"
