# Prerequisites

The only runtime prerequisite is a **GitHub personal access token**. The pre-compiled binary is self-contained and has no runtime dependency — you do not need Bun to run it.

::: tip Building from source?
If you want to build `github-code-search` from source, you will additionally need [Bun](https://bun.sh) ≥ 1.0. See the [Installation guide](/getting-started/installation#from-source).
:::

## GitHub token

A GitHub personal access token (PAT) is required to call the GitHub code search API.

### Required scopes

| Scope         | When needed                                             |
| ------------- | ------------------------------------------------------- |
| `repo`        | Searching **private** repositories                      |
| `public_repo` | Searching public repositories only                      |
| `read:org`    | Using `--group-by-team-prefix` to group results by team |

::: tip Classic vs fine-grained tokens
Both token types work. Classic tokens are simpler to configure for org-wide searches.
Fine-grained tokens require explicit repository access per repo, which is impractical for org-wide searches.
:::

### Set the token

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

Add this to your shell profile (`~/.zshrc`, `~/.bashrc`, `~/.config/fish/config.fish`, …) to make it permanent.

::: warning Token security
Never commit your token to version control. Use environment variables or a secrets manager.
:::

## Next step

→ [Install github-code-search](/getting-started/installation)
