---
title: "What's new in v1.11.0"
description: "Team pick mode and --exclude-template-repositories — resolve multi-team sections interactively or via CLI, and filter template repos from search results."
date: 2026-03-30
---

# What's new in github-code-search v1.11.0

> Full release notes: <https://github.com/fulll/github-code-search/releases/tag/v1.11.0>

## Highlights

### Team pick mode — resolve multi-team ownership interactively

When using `--group-by-team-prefix`, repositories that belong to **multiple teams** appear under combined section headers such as `squad-frontend + squad-mobile`. In v1.11.0, you can now resolve these ambiguous sections in real time from the TUI.

Navigate to a combined section header and press **`p`** to enter pick mode. The header turns into a horizontal picker:

```
── [ squad-frontend ]  squad-mobile
```

The highlighted team (bold, wrapped in `[ ]`) is the current candidate. Navigate sideways and confirm your choice:

| Key       | Action                                   |
| --------- | ---------------------------------------- |
| `←` / `→` | Move focus between candidate teams       |
| `Enter`   | Confirm — section label updates in place |
| `Esc`     | Cancel — no change                       |

Repos moved by pick mode are annotated with a **`◈`** badge so you can track assignments at a glance.

### `--pick-team` — pre-assign sections without the TUI

Assignments can also be made up front with the repeatable `--pick-team` option — useful in CI or when replaying a previous run:

```bash
github-code-search query "useFeatureFlag" --org fulll \
  --group-by-team-prefix squad- \
  --pick-team "squad-frontend + squad-mobile"=squad-frontend \
  --pick-team "squad-backend + squad-data"=squad-backend
```

The replay command printed at the top of the markdown output now includes `--pick-team` flags automatically when picks were confirmed interactively, so **every run is fully reproducible**.

If a combined label is not found (typo, stale label), a warning is emitted on stderr listing the available sections — the run continues without error.

### `--exclude-template-repositories` — clean up template noise

GitHub template repositories often appear in search results even when they are not the target of the search (e.g. a boilerplate that was never extended). A new flag lets you exclude them entirely:

```bash
github-code-search "useFeatureFlag" --org fulll \
  --exclude-template-repositories
```

Template repos are identified using the `is_template` field returned by the GitHub API — no additional token scope is required. The flag is also recorded in the replay command so non-interactive reruns are consistent.

### Security improvements

This release also ships **hardened implementations** of the `cache` and `upgrade` modules, guided by an Aikido security scan:

- Path inputs are now validated before any filesystem operations.
- The upgrade path uses a safer temporary-file write strategy.
- A `dependabot.yml` is now in place to keep GitHub Actions dependencies up to date.

### Windows installer fixes (patch)

The PowerShell installer (`install.ps1`) now:

- Avoids the `Invoke-WebRequest` security warning that appeared on default Windows security configurations.
- Falls back to `curl.exe` (bundled with Windows 10+) when the GitHub API is unreachable for a specific version lookup.

---

## Upgrade

```sh
github-code-search upgrade
```

Or download the latest binary from
[GitHub Releases](https://github.com/fulll/github-code-search/releases/tag/v1.11.0).
