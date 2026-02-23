# Installation

## Via `curl` (recommended)

The install script auto-detects your OS (Linux, macOS) and architecture (x64, arm64) and downloads the right pre-compiled binary from the [latest release](https://github.com/fulll/github-code-search/releases/latest) to `/usr/local/bin`.

```bash
curl -fsSL https://raw.githubusercontent.com/fulll/github-code-search/main/install.sh | bash
```

### Custom install directory or version

```bash
INSTALL_DIR=~/.local/bin VERSION=v1.1.0 \
  curl -fsSL https://raw.githubusercontent.com/fulll/github-code-search/main/install.sh | bash
```

| Variable      | Default          | Description                                     |
| ------------- | ---------------- | ----------------------------------------------- |
| `INSTALL_DIR` | `/usr/local/bin` | Directory where the binary is installed         |
| `VERSION`     | latest release   | Specific version tag to install (e.g. `v1.0.6`) |

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

The build script supports cross-compilation for all supported targets:

```bash
bun run build.ts --target=bun-linux-x64
bun run build.ts --target=bun-linux-arm64
bun run build.ts --target=bun-darwin-arm64
bun run build.ts --target=bun-darwin-x64
```

See [CONTRIBUTING.md](https://github.com/fulll/github-code-search/blob/main/CONTRIBUTING.md) for the full list of targets.

## Verify the installation

```bash
github-code-search --version
# → 1.1.0 (abc1234 · darwin/arm64)
```

The version string includes the commit SHA, OS and architecture — useful for bug reports.

## Upgrade

Once installed, you can upgrade to the latest release with a single command:

```bash
github-code-search upgrade
```

See the [Upgrade guide](/usage/upgrade) for details.

## Next step

→ [Run your first search](/getting-started/first-search)
