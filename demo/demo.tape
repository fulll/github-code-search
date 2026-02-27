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

# ── Navigate down a few rows ──────────────────────────────────────────────────
Down
Sleep 300ms
Down
Sleep 300ms
Down
Sleep 300ms

# ── Toggle selection off on current extract ───────────────────────────────────
Space
Sleep 400ms

# ── Enter filter mode to exclude .ts files ────────────────────────────────────
Type "f"
Sleep 300ms
Type ".yml"
Sleep 600ms
Enter
Sleep 500ms

# ── Select all visible (filtered) rows ────────────────────────────────────────
Type "a"
Sleep 500ms

# ── Reset filter ──────────────────────────────────────────────────────────────
Type "r"
Sleep 600ms

# ── Confirm and print output ──────────────────────────────────────────────────
Enter

Sleep 2s
