# Prerequisites

Before using `github-code-search`, you need two things: **Bun** and a **GitHub personal access token**.

## Bun ≥ 1.0

`github-code-search` is a self-contained binary compiled with [Bun](https://bun.sh). You do **not** need Bun installed to run the pre-compiled binary — it has no runtime dependency.

You only need Bun if you want to [build from source](/getting-started/installation#from-source).

## GitHub token

A GitHub personal access token (PAT) is required to call the GitHub code search API.

### Required scopes

| Scope         | When needed                                                                     |
| ------------- | ------------------------------------------------------------------------------- |
| `repo`        | Searching **private** repositories                                              |
| `public_repo` | Searching public repositories only                                              |
| `read:org`    | Using [`--group-by-team-prefix`](/usage/team-grouping) to group results by team |

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
