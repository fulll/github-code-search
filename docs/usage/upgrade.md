# Upgrade

`github-code-search` includes a self-upgrade command that downloads and replaces the binary in-place.

## Auto-upgrade

```bash
github-code-search upgrade
```

The command:

1. Fetches the [latest release](https://github.com/fulll/github-code-search/releases/latest) from GitHub.
2. Compares it against the currently running version.
3. If a newer version is available, downloads the matching binary for your OS and architecture and replaces the currently running binary.
4. Prints the new version string on success.

```text
$ github-code-search upgrade
Checking for updates…
Already up to date (v1.2.0).
```

```text
$ github-code-search upgrade
Checking for updates…
Upgrading v1.2.0 → v1.3.0…
Successfully upgraded to v1.3.0.
```

## Token requirement

The `upgrade` subcommand works without a `GITHUB_TOKEN`. A token is used only if the `GITHUB_TOKEN` environment variable is already set (to avoid GitHub API rate limiting on the release fetch).

## Checking the current version

```bash
github-code-search --version
# → 1.2.0 (abc1234 · darwin/arm64)
```

The version string includes the **git commit SHA**, **OS**, and **architecture** of the compiled binary.

## Manual upgrade

If the auto-upgrade fails (e.g. write permission denied), you can upgrade manually using the install script:

```bash
curl -fsSL https://raw.githubusercontent.com/fulll/github-code-search/main/install.sh | bash
```

To install a specific version:

```bash
VERSION=vX.Y.Z curl -fsSL \
  https://raw.githubusercontent.com/fulll/github-code-search/main/install.sh | bash
```

To install to a custom directory:

```bash
INSTALL_DIR=~/.local/bin curl -fsSL \
  https://raw.githubusercontent.com/fulll/github-code-search/main/install.sh | bash
```
