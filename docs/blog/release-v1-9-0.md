---
title: "What's new in v1.9.0"
description: "github-code-search is now available on Windows — native x64, x64-modern (AVX2), x64-baseline and ARM64 binaries"
date: 2026-03-11
---

# What's new in github-code-search v1.9.0

> Full release notes: <https://github.com/fulll/github-code-search/releases/tag/v1.9.0>

## Highlights

### Windows support — four native architectures

`github-code-search` now ships pre-built `.exe` binaries for Windows:

| Binary                                        | Target CPU                              |
| --------------------------------------------- | --------------------------------------- |
| `github-code-search-windows-x64-modern.exe`   | AVX2 / SSE4.2 (most CPUs since ~2013)   |
| `github-code-search-windows-x64-baseline.exe` | Any x86-64 CPU                          |
| `github-code-search-windows-x64.exe`          | Legacy alias for backward compatibility |
| `github-code-search-windows-arm64.exe`        | ARM64 (Snapdragon X, Surface Pro X …)   |

The installer picks the best variant for your machine automatically and falls
back through `x64-modern → x64-baseline → x64` if a variant is missing from
a given release.

### One-line PowerShell installer

Installing from an elevated PowerShell prompt is now a single command:

```powershell
irm https://github.com/fulll/github-code-search/install.ps1 | iex
```

The script detects your architecture, downloads the optimal binary to
`%LOCALAPPDATA%\github-code-search`, and adds the directory to your user `PATH`
automatically.

To install a specific version or architecture:

```powershell
irm https://github.com/fulll/github-code-search/install.ps1 | iex
# or
Invoke-RestMethod https://github.com/fulll/github-code-search/install.ps1 | Invoke-Expression
```

### EXE metadata and icon

The Windows binaries embed proper file metadata (title, publisher, version,
description, copyright) so they show correctly in Explorer file properties and
are not mis-identified as generic `bun` processes.  
A multi-resolution `.ico` icon (16×16 → 256×256) is also baked into the binary,
making the executable recognisable in taskbar, `Alt+Tab` and file dialogs.

---

## Upgrade

```sh
github-code-search upgrade
```

Or download the latest binary from
[GitHub Releases](https://github.com/fulll/github-code-search/releases/tag/v1.9.0).
