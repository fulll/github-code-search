#!/usr/bin/env bash
# install.sh — download and install the latest github-code-search binary.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/fulll/github-code-search/main/install.sh | bash
#
# Environment variables:
#   INSTALL_DIR   destination directory (default: /usr/local/bin)
#   VERSION       specific version tag to install (default: latest)

BINARY_NAME="github-code-search"

# ─── Shell completions ────────────────────────────────────────────────────────
# Defined early so it can be sourced and tested independently (INSTALL_SH_TEST=1).
# Note: set -euo pipefail is intentionally NOT set here — it is applied only in
# the main installation block below so that sourcing this file for bats tests
# does not alter the caller's shell options.

install_completions() {
  local bin="$1"
  local shell_name
  shell_name="$(basename "${SHELL:-}")"

  case "$shell_name" in
    fish)
      local comp_dir="${XDG_CONFIG_HOME:-$HOME/.config}/fish/completions"
      local comp_file="${comp_dir}/github-code-search.fish"
      mkdir -p "$comp_dir"
      "$bin" completions --shell fish > "$comp_file"
      echo ""
      echo "✓ Fish completions installed at ${comp_file}"
      ;;
    zsh)
      local comp_dir="${ZDOTDIR:-$HOME}/.zfunc"
      local comp_file="${comp_dir}/_github-code-search"
      mkdir -p "$comp_dir"
      "$bin" completions --shell zsh > "$comp_file"
      echo ""
      echo "✓ Zsh completions installed at ${comp_file}"
      echo "  Make sure ${comp_dir} is on your fpath. Add to ~/.zshrc if needed:"
      echo "    fpath=(${comp_dir} \$fpath)"
      echo "    autoload -Uz compinit && compinit"
      ;;
    bash)
      local comp_dir="${XDG_DATA_HOME:-$HOME/.local/share}/bash-completion/completions"
      local comp_file="${comp_dir}/github-code-search"
      mkdir -p "$comp_dir"
      "$bin" completions --shell bash > "$comp_file"
      echo ""
      echo "✓ Bash completions installed at ${comp_file}"
      ;;
    *)
      echo ""
      echo "  Shell completions are available for bash, zsh and fish."
      echo "  Run the following to generate your completion script:"
      echo "    ${BINARY_NAME} completions --shell <bash|zsh|fish>"
      ;;
  esac
}

# ─── Main installation ────────────────────────────────────────────────────────
# Skipped when sourced for testing (export INSTALL_SH_TEST=1 before sourcing).

if [ -z "${INSTALL_SH_TEST:-}" ]; then
  set -euo pipefail

  REPO="fulll/github-code-search"
  INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
  GITHUB_API="https://api.github.com"

  # ─── Detect OS ──────────────────────────────────────────────────────────────

  case "$(uname -s)" in
    Linux*)   OS="linux" ;;
    Darwin*)  OS="macos" ;;
    MINGW*|MSYS*|CYGWIN*) OS="windows" ;;
    *)
      echo "error: unsupported OS: $(uname -s)" >&2
      exit 1
      ;;
  esac

  # ─── Detect architecture ────────────────────────────────────────────────────

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

  # ─── Resolve version ────────────────────────────────────────────────────────

  if [ -n "${VERSION:-}" ]; then
    TAG="$VERSION"
  else
    echo "Detecting latest release…"
    TAG=$(curl -fsSL "${GITHUB_API}/repos/${REPO}/releases/latest" \
      | grep '"tag_name"' \
      | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')
  fi

  echo "Installing ${BINARY_NAME} ${TAG} (${OS}/${ARCH})…"

  # ─── Download ───────────────────────────────────────────────────────────────

  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${TAG}/${ARTIFACT}"
  TMP="$(mktemp)"
  curl -fsSL --progress-bar -o "$TMP" "$DOWNLOAD_URL"
  chmod +x "$TMP"

  # ─── Install ────────────────────────────────────────────────────────────────

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

  install_completions "$DEST"

fi
