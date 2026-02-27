# Installation

## Via `curl` (recommended)

The install script auto-detects your OS (Linux, macOS, Windows via MINGW/MSYS/Cygwin) and architecture (x64, arm64) and downloads the right pre-compiled binary from the [latest release](https://github.com/fulll/github-code-search/releases/latest) to `/usr/local/bin`.

::: warning Windows
On Windows, the script requires a bash-compatible shell (Git Bash, MSYS2, or Cygwin). Native PowerShell is not supported — download the binary directly from the [releases page](https://github.com/fulll/github-code-search/releases/latest) instead.
:::

```bash
curl -fsSL https://raw.githubusercontent.com/fulll/github-code-search/main/install.sh | bash
```

### Custom install directory or version

```bash
INSTALL_DIR=~/.local/bin VERSION=vX.Y.Z \
  curl -fsSL https://raw.githubusercontent.com/fulll/github-code-search/main/install.sh | bash
```

| Variable      | Default          | Description                                     |
| ------------- | ---------------- | ----------------------------------------------- |
| `INSTALL_DIR` | `/usr/local/bin` | Directory where the binary is installed         |
| `VERSION`     | latest release   | Specific version tag to install (e.g. `v1.1.0`) |

## From source

Requires [Bun](https://bun.sh) ≥ 1.0.

```bash
git clone https://github.com/fulll/github-code-search
cd github-code-search
bun install
bun run build.ts
# → produces dist/github-code-search
```

Copy the binary wherever you like:

```bash
cp dist/github-code-search ~/.local/bin/
```

### Cross-compilation

The build script accepts any Bun executable target via `--target`:

```bash
bun run build.ts --target=bun-linux-x64
bun run build.ts --target=bun-linux-x64-baseline
bun run build.ts --target=bun-linux-arm64
bun run build.ts --target=bun-darwin-x64
bun run build.ts --target=bun-darwin-arm64
bun run build.ts --target=bun-windows-x64
```

## Verify the installation

```bash
github-code-search --version
# → X.Y.Z (abc1234 · darwin/arm64)
```

The version string includes the commit SHA, OS and architecture — useful for bug reports.

## Upgrade

Once installed, you can upgrade to the latest release with a single command:

```bash
github-code-search upgrade
```

## macOS Gatekeeper

If you download the binary **directly from the releases page in a browser** (Chrome, Safari…), macOS marks it with a quarantine flag and Gatekeeper will block it on first launch.

Remove the quarantine attribute once after downloading:

```bash
xattr -d com.apple.quarantine ./github-code-search-darwin-arm64
```

::: tip
This is unnecessary when installing via the `curl` script above, or when using the `upgrade` subcommand — both handle it automatically.
:::

## Next step

→ [Run your first search](/getting-started/first-search)
