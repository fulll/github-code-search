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
Set Padding 24
Set TypingSpeed 70ms

# ── Show the prompt ────────────────────────────────────────────────────────────
Hide
Type "export GITHUB_TOKEN=$GITHUB_TOKEN"
Enter
Show

Sleep 700ms

# ── Type the command ──────────────────────────────────────────────────────────
Type 'github-code-search query "@actions/cache" --org actions'
Sleep 1s
Enter

# Wait for results to load (API call + TUI render)
Sleep 4s

# ── Fold all repos — Z gives a compact bird's-eye view ────────────────────────
Type "Z"
Sleep 1s

# ── Unfold all repos — Z again expands everything ─────────────────────────────
Type "Z"
Sleep 1s

# ── Filter by file path to focus on YAML files ────────────────────────────────
Type "f"
Sleep 400ms
Type ".yml"
Sleep 800ms
Enter
Sleep 700ms

# ── Jump to top with gg ───────────────────────────────────────────────────────
Type "g"
Sleep 200ms
Type "g"
Sleep 700ms

# ── Select all visible (filtered) results ─────────────────────────────────────
Type "a"
Sleep 700ms

# ── Jump to bottom with G to inspect the last match ───────────────────────────
Type "G"
Sleep 800ms

# ── Open the focused file directly in the browser ─────────────────────────────
Type "o"
Sleep 800ms

# ── Reset filter and confirm selection ────────────────────────────────────────
Type "r"
Sleep 800ms
Enter

# Hold on the final markdown output — query title heading + matched token per extract
Sleep 4s
