#!/usr/bin/env pwsh
# install.ps1 — download and install the latest github-code-search binary on Windows.
#
# Usage:
#   powershell -c "irm https://raw.githubusercontent.com/fulll/github-code-search/main/install.ps1 | iex"
#
# With options:
#   & { $(irm https://raw.githubusercontent.com/fulll/github-code-search/main/install.ps1) } -Version v1.8.0

param(
  [String]$Version = "latest",
  [String]$InstallDir = "${Home}\.github-code-search\bin",
  [Switch]$NoPathUpdate = $false,
  [Switch]$DownloadWithoutCurl = $false
)

Set-StrictMode -Version Latest

$BinaryName = "github-code-search"
$Repo = "fulll/github-code-search"

# ── Helpers ──────────────────────────────────────────────────────────────────

function Publish-Env {
  if (-not ("Win32.NativeMethods" -as [Type])) {
    Add-Type -Namespace Win32 -Name NativeMethods -MemberDefinition @"
[DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
public static extern IntPtr SendMessageTimeout(
    IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam,
    uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);
"@
  }

  $HWND_BROADCAST = [IntPtr] 0xffff
  $WM_SETTINGCHANGE = 0x1a
  $result = [UIntPtr]::Zero
  [Win32.NativeMethods]::SendMessageTimeout($HWND_BROADCAST, $WM_SETTINGCHANGE, [UIntPtr]::Zero, "Environment", 2, 5000, [ref] $result) | Out-Null
}

function Get-Env {
  param([String]$Key)
  $RegisterKey = Get-Item -Path 'HKCU:'
  $EnvRegisterKey = $RegisterKey.OpenSubKey('Environment')
  $EnvRegisterKey.GetValue($Key, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
}

function Write-Env {
  param([String]$Key, [String]$Value)
  $RegisterKey = Get-Item -Path 'HKCU:'
  $EnvRegisterKey = $RegisterKey.OpenSubKey('Environment', $true)
  if ($null -eq $Value) {
    $EnvRegisterKey.DeleteValue($Key)
  } else {
    $RegistryValueKind = if ($Value.Contains('%')) {
      [Microsoft.Win32.RegistryValueKind]::ExpandString
    } else {
      [Microsoft.Win32.RegistryValueKind]::String
    }
    $EnvRegisterKey.SetValue($Key, $Value, $RegistryValueKind)
  }
  Publish-Env
}

# ── Architecture detection ───────────────────────────────────────────────────

$Arch = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment').PROCESSOR_ARCHITECTURE

switch ($Arch) {
  "AMD64" {
    # Prefer the modern (AVX2) variant; fall back to the baseline build on older
    # hardware. The caller can force a specific variant by setting $Target before
    # running the script, or by passing a pre-resolved $Version that embeds the
    # variant in the tag name.
    # We probe the release assets via the GitHub API to choose automatically.
    $Target = "x64-modern"
  }
  "ARM64" { $Target = "arm64" }
  default {
    Write-Output "Install Failed:"
    Write-Output "  ${BinaryName} for Windows does not support architecture: $Arch"
    return 1
  }
}

# ── Windows version guard ────────────────────────────────────────────────────

$MinBuild = 17763  # Windows 10 1809 / Windows Server 2019
$MinBuildName = "Windows 10 1809"
$WinVer = [System.Environment]::OSVersion.Version

if ($WinVer.Major -lt 10 -or ($WinVer.Major -eq 10 -and $WinVer.Build -lt $MinBuild)) {
  Write-Warning "${BinaryName} requires ${MinBuildName} or newer (build ${MinBuild}+)."
  Write-Warning "Your system: Windows $($WinVer.Major).$($WinVer.Minor) build $($WinVer.Build)"
  return 1
}

$ErrorActionPreference = "Stop"

# ── Resolve version ──────────────────────────────────────────────────────────

if ($Version -eq "latest") {
  Write-Output "Detecting latest release..."
  $ApiUrl = "https://api.github.com/repos/${Repo}/releases/latest"

  try {
    $Response = Invoke-RestMethod -Uri $ApiUrl -Headers @{ "Accept" = "application/vnd.github.v3+json" }
    $Tag = $Response.tag_name
  } catch {
    Write-Output "Install Failed:"
    Write-Output "  Could not determine the latest release from the GitHub API."
    Write-Output "  URL: $ApiUrl"
    Write-Output "  $_"
    return 1
  }
} else {
  $Tag = $Version
}

# ── Resolve artifact name with automatic x64 fallback ────────────────────────
#
# Release layout (as of v1.9.0):
#   github-code-search-windows-x64-modern.exe   — AVX2 / SSE4.2 (most CPUs since ~2013)
#   github-code-search-windows-x64-baseline.exe — compatible with any x86-64 CPU
#   github-code-search-windows-x64.exe           — legacy alias kept for back-compat
#   github-code-search-windows-arm64.exe         — ARM64

$CandidateTargets = @($Target)
if ($Target -eq "x64-modern") {
  $CandidateTargets += "x64-baseline"
}

$Artifact = $null
foreach ($Candidate in $CandidateTargets) {
  $CandidateArtifact = "${BinaryName}-windows-${Candidate}.exe"
  $CheckUrl = "https://github.com/${Repo}/releases/download/${Tag}/${CandidateArtifact}"
  try {
    $Null = Invoke-WebRequest -Uri $CheckUrl -Method Head -UseBasicParsing -ErrorAction Stop
    $Artifact = $CandidateArtifact
    $Target = $Candidate
    break
  } catch {
    Write-Output "  Variant windows-${Candidate} not found in release ${Tag}, trying next..."
  }
}

if ($null -eq $Artifact) {
  Write-Output "Install Failed:"
  Write-Output "  No compatible Windows binary found for ${Tag}."
  Write-Output "  Tried: $($CandidateTargets -join ', ')"
  return 1
}

Write-Output "Installing ${BinaryName} ${Tag} (windows/${Target})..."

# ── Download ─────────────────────────────────────────────────────────────────

$DownloadUrl = "https://github.com/${Repo}/releases/download/${Tag}/${Artifact}"
$TmpDir = $env:TEMP
$TmpFile = Join-Path $TmpDir $Artifact

$DownloadFailed = $false

if (-not $DownloadWithoutCurl) {
  try {
    curl.exe "-#SfLo" "$TmpFile" "$DownloadUrl"
    if ($LASTEXITCODE -ne 0) {
      $DownloadFailed = $true
    }
  } catch {
    $DownloadFailed = $true
  }
}

if ($DownloadWithoutCurl -or $DownloadFailed) {
  try {
    Write-Output "Downloading with Invoke-RestMethod..."
    Invoke-RestMethod -Uri $DownloadUrl -OutFile $TmpFile
  } catch {
    Write-Output "Install Failed:"
    Write-Output "  Could not download ${BinaryName} ${Tag}."
    Write-Output "  URL: $DownloadUrl"
    Write-Output ""
    Write-Output "  $_"
    Write-Output ""
    Write-Output "  If your antivirus is blocking the download, try adding an exclusion."
    return 1
  }
}

if (-not (Test-Path $TmpFile)) {
  Write-Output "Install Failed:"
  Write-Output "  Downloaded file not found at ${TmpFile}."
  Write-Output "  This may be caused by antivirus software (e.g. Windows Defender) quarantining the binary."
  Write-Output "  Try adding an exclusion for ${TmpFile} and retry."
  return 1
}

# ── Install ──────────────────────────────────────────────────────────────────

$null = New-Item -ItemType Directory -Path $InstallDir -Force
$DestPath = Join-Path $InstallDir "${BinaryName}.exe"

try {
  Move-Item -Path $TmpFile -Destination $DestPath -Force
} catch {
  Write-Output "Install Failed:"
  Write-Output "  Could not move binary to ${DestPath}."
  Write-Output "  $_"
  Write-Output ""
  Write-Output "  If the file is in use, close any running instance and retry."
  Write-Output "  If your antivirus deleted the file, add an exclusion and retry."
  return 1
}

# ── PATH update ──────────────────────────────────────────────────────────────

if (-not $NoPathUpdate) {
  $Path = (Get-Env -Key "Path") -split ';'
  if ($Path -notcontains $InstallDir) {
    $Path += $InstallDir
    Write-Env -Key 'Path' -Value ($Path -join ';')
    $env:Path = "${InstallDir};${env:Path}"
    Write-Output ""
    Write-Output "  Added ${InstallDir} to user PATH."
  }
}

# ── Verification ─────────────────────────────────────────────────────────────

try {
  $InstalledVersion = & $DestPath --version
  Write-Output ""
  Write-Output "  ${BinaryName} ${Tag} installed successfully!"
  Write-Output "  Binary: ${DestPath}"
  Write-Output "  Version: ${InstalledVersion}"
  Write-Output ""
  Write-Output "  Remember to set your GitHub token:"
  Write-Output '  $env:GITHUB_TOKEN = "ghp_your_token_here"'
} catch {
  Write-Output ""
  Write-Output "  ${BinaryName} was installed to ${DestPath},"
  Write-Output "  but the verification command (--version) failed:"
  Write-Output "  $_"
  Write-Output ""
  Write-Output "  This may be caused by antivirus software blocking execution."
  Write-Output "  Try adding an exclusion for ${DestPath} and run:"
  Write-Output "    ${BinaryName} --version"
}
