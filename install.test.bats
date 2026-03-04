#!/usr/bin/env bats
# install.test.bats — unit tests for the install_completions() function in install.sh.
#
# Run with:
#   bats install.test.bats

# ─── Helpers ─────────────────────────────────────────────────────────────────

setup() {
  # Isolated home directory for each test
  TEST_HOME="$(mktemp -d)"
  export HOME="$TEST_HOME"

  # Stub binary: responds to "completions --shell <shell>" by printing a
  # recognisable string that includes the shell name.
  MOCK_BIN="${TEST_HOME}/github-code-search"
  cat > "$MOCK_BIN" << 'EOF'
#!/usr/bin/env bash
# Stub github-code-search binary
if [ "${1:-}" = "completions" ] && [ "${2:-}" = "--shell" ]; then
  echo "# mock completion script for ${3:-unknown}"
fi
EOF
  chmod +x "$MOCK_BIN"

  # Source install.sh without executing the main block
  INSTALL_SH_TEST=1 source "${BATS_TEST_DIRNAME}/install.sh"
}

teardown() {
  unset XDG_CONFIG_HOME XDG_DATA_HOME ZDOTDIR
  rm -rf "$TEST_HOME"
}

# ─── Fish ─────────────────────────────────────────────────────────────────────

@test "fish: creates completion file at ~/.config/fish/completions/github-code-search.fish" {
  export SHELL="/usr/bin/fish"
  run install_completions "$MOCK_BIN"
  [ "$status" -eq 0 ]
  [ -f "${HOME}/.config/fish/completions/github-code-search.fish" ]
}

@test "fish: completion file content comes from 'completions --shell fish'" {
  export SHELL="/usr/bin/fish"
  install_completions "$MOCK_BIN"
  run cat "${HOME}/.config/fish/completions/github-code-search.fish"
  [[ "$output" == *"fish"* ]]
}

@test "fish: output confirms installation path" {
  export SHELL="/usr/bin/fish"
  run install_completions "$MOCK_BIN"
  [[ "$output" == *"Fish completions installed at"* ]]
}

@test "fish: respects XDG_CONFIG_HOME override" {
  export SHELL="/usr/bin/fish"
  export XDG_CONFIG_HOME="${HOME}/custom_xdg"
  run install_completions "$MOCK_BIN"
  [ "$status" -eq 0 ]
  [ -f "${HOME}/custom_xdg/fish/completions/github-code-search.fish" ]
}

# ─── Zsh ──────────────────────────────────────────────────────────────────────

@test "zsh: creates completion file at ~/.zfunc/_github-code-search" {
  export SHELL="/usr/bin/zsh"
  run install_completions "$MOCK_BIN"
  [ "$status" -eq 0 ]
  [ -f "${HOME}/.zfunc/_github-code-search" ]
}

@test "zsh: completion file content comes from 'completions --shell zsh'" {
  export SHELL="/usr/bin/zsh"
  install_completions "$MOCK_BIN"
  run cat "${HOME}/.zfunc/_github-code-search"
  [[ "$output" == *"zsh"* ]]
}

@test "zsh: output includes fpath hint" {
  export SHELL="/usr/bin/zsh"
  run install_completions "$MOCK_BIN"
  [[ "$output" == *"fpath"* ]]
}

@test "zsh: respects ZDOTDIR override" {
  export SHELL="/usr/bin/zsh"
  export ZDOTDIR="${HOME}/custom_zdot"
  run install_completions "$MOCK_BIN"
  [ "$status" -eq 0 ]
  [ -f "${HOME}/custom_zdot/.zfunc/_github-code-search" ]
}

# ─── Bash ─────────────────────────────────────────────────────────────────────

@test "bash: creates completion file at ~/.local/share/bash-completion/completions/github-code-search" {
  export SHELL="/usr/bin/bash"
  run install_completions "$MOCK_BIN"
  [ "$status" -eq 0 ]
  [ -f "${HOME}/.local/share/bash-completion/completions/github-code-search" ]
}

@test "bash: completion file content comes from 'completions --shell bash'" {
  export SHELL="/usr/bin/bash"
  install_completions "$MOCK_BIN"
  run cat "${HOME}/.local/share/bash-completion/completions/github-code-search"
  [[ "$output" == *"bash"* ]]
}

@test "bash: output confirms installation path" {
  export SHELL="/usr/bin/bash"
  run install_completions "$MOCK_BIN"
  [[ "$output" == *"Bash completions installed at"* ]]
}

@test "bash: respects XDG_DATA_HOME override" {
  export SHELL="/usr/bin/bash"
  export XDG_DATA_HOME="${HOME}/custom_data"
  run install_completions "$MOCK_BIN"
  [ "$status" -eq 0 ]
  [ -f "${HOME}/custom_data/bash-completion/completions/github-code-search" ]
}

# ─── Unknown shell ────────────────────────────────────────────────────────────

@test "unknown shell: prints manual instructions" {
  export SHELL="/usr/bin/tcsh"
  run install_completions "$MOCK_BIN"
  [ "$status" -eq 0 ]
  [[ "$output" == *"completions --shell"* ]]
}

@test "unknown shell: does not create any completion file" {
  export SHELL="/usr/bin/tcsh"
  run install_completions "$MOCK_BIN"
  [ ! -f "${HOME}/.config/fish/completions/github-code-search.fish" ]
  [ ! -f "${HOME}/.zfunc/_github-code-search" ]
  [ ! -f "${HOME}/.local/share/bash-completion/completions/github-code-search" ]
}

@test "empty SHELL: prints manual instructions" {
  export SHELL=""
  run install_completions "$MOCK_BIN"
  [ "$status" -eq 0 ]
  [[ "$output" == *"completions --shell"* ]]
}
