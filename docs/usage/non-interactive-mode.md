# Non-interactive mode

Non-interactive mode bypasses the TUI and prints results directly to stdout. Use it in CI pipelines, shell scripts, or whenever you want to process results programmatically.

## Enabling non-interactive mode

Three equivalent methods:

```bash
# 1. Set the standard CI environment variable
CI=true github-code-search "useFeatureFlag" --org fulll

# 2. Use the explicit flag
github-code-search "useFeatureFlag" --org fulll --no-interactive

# 3. GitHub Actions — CI=true is set automatically
- run: github-code-search "useFeatureFlag" --org fulll
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

::: tip
In any environment where `CI=true` is set (GitHub Actions, GitLab CI, CircleCI, etc.), non-interactive mode is activated automatically — you don't need `--no-interactive`.
:::

## Example output

```bash
$ CI=true github-code-search "useFeatureFlag" --org fulll
```

```text
3 repos · 5 matches selected

- **fulll/auth-service**
  - [ ] [src/middlewares/featureFlags.ts:2:19](https://github.com/fulll/auth-service/blob/main/src/middlewares/featureFlags.ts#L2)
  - [ ] [tests/unit/featureFlags.test.ts:1:8](https://github.com/fulll/auth-service/blob/main/tests/unit/featureFlags.test.ts#L1)
- **fulll/billing-api**
  - [ ] [src/flags.ts:3:14](https://github.com/fulll/billing-api/blob/main/src/flags.ts#L3)
  - [ ] [src/routes/invoices.ts:1:1](https://github.com/fulll/billing-api/blob/main/src/routes/invoices.ts#L1)
- **fulll/frontend-app**
  - [ ] [src/hooks/useFeatureFlag.ts:1:1](https://github.com/fulll/frontend-app/blob/main/src/hooks/useFeatureFlag.ts#L1)
```

<details>
<summary>replay command</summary>

```bash
github-code-search "useFeatureFlag" --org fulll --no-interactive
```

</details>

## Replay command

At the end of every interactive session, `github-code-search` prints a **replay command** that encodes your exact selections as `--exclude-repositories` and `--exclude-extracts` arguments. Copy it to rerun the same filtered search in non-interactive mode:

```bash
github-code-search "useFeatureFlag" --org fulll --no-interactive \
  --exclude-repositories legacy-monolith \
  --exclude-extracts auth-service:tests/unit/featureFlags.test.ts:0
```

This is the recommended bridge between an interactive exploration session and a reproducible CI step.

## GitHub Actions example

```yaml
- name: Search for feature flag usages
  run: |
    github-code-search "useFeatureFlag" --org fulll \
      --format json \
      --output-type repo-only \
      > results.json
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Combining with shell tools

The Markdown output can be piped directly into other tools:

```bash
# Count how many repos contain the pattern
CI=true github-code-search "TODO" --org fulll \
  --output-type repo-only | grep -c "^\- \*\*"
```

```bash
# Process JSON output with jq
CI=true github-code-search "useFeatureFlag" --org fulll --format json \
  | jq '[.results[].repo]'
```

## What's next?

- [Output formats](/usage/output-formats) — choose between Markdown and JSON
- [Filtering](/usage/filtering) — pre-exclude repos or extracts before running
