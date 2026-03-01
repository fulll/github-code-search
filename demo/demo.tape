# VHS tape — terminal demo for README
# Usage:
#   1. Install VHS:           brew install vhs
#   2. Build the binary:      bun run build.ts
#   3. Export your token:     export GITHUB_TOKEN=ghp_...
#   4. Record:                vhs demo/demo.tape
#
# The GIF is written to demo/demo.gif — add it to README.md with:
#   ![demo](demo/demo.gif)

Output demo/demo.gif

Require github-code-search

Set Shell "bash"
Set FontSize 15
Set Width 1200
Set Height 600
Set Theme "Catppuccin Mocha"
Set Padding 24
Set TypingSpeed 60ms

# ── Show the prompt ────────────────────────────────────────────────────────────
Hide
Type "export GITHUB_TOKEN=$GITHUB_TOKEN"
Enter
Show

Sleep 500ms

# ── Type the command ──────────────────────────────────────────────────────────
Type 'github-code-search query "@actions/cache" --org actions'
Sleep 800ms
Enter

# Wait for results to load (API call + TUI render)
Sleep 4s

# ── Fold all repos — Z gives a compact bird's-eye view ────────────────────────
Type "Z"
Sleep 800ms

# ── Unfold all repos — Z again expands everything ─────────────────────────────
Type "Z"
Sleep 800ms

# ── Filter by file path to focus on YAML files ────────────────────────────────
Type "f"
Sleep 300ms
Type ".yml"
Sleep 600ms
Enter
Sleep 500ms

# ── Jump to top with gg ───────────────────────────────────────────────────────
Type "g"
Sleep 150ms
Type "g"
Sleep 500ms

# ── Select all visible (filtered) results ─────────────────────────────────────
Type "a"
Sleep 500ms

# ── Jump to bottom with G to inspect the last match ───────────────────────────
Type "G"
Sleep 600ms

# ── Open the focused file directly in the browser ─────────────────────────────
Type "o"
Sleep 600ms

# ── Reset filter and confirm selection ────────────────────────────────────────
Type "r"
Sleep 600ms
Enter

Sleep 2s
