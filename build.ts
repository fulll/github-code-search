#!/usr/bin/env bun
/**
 * Build script – compiles github-code-search.ts into a standalone binary.
 *
 * Usage:
 *   bun run build.ts                               # current platform
 *   bun run build.ts --target=bun-linux-x64        # cross-compile
 *
 * Supported targets (Bun executables):
 *   bun-linux-x64  bun-linux-x64-baseline  bun-linux-arm64
 *   bun-darwin-x64  bun-darwin-arm64
 *   bun-windows-x64  bun-windows-x64-baseline  bun-windows-x64-modern
 *   bun-windows-arm64
 */

import { version, description, author, license } from "./package.json" with { type: "json" };

// ─── Pure helpers (exported for unit tests) ───────────────────────────────────

export type ParsedTarget = {
  os: string;
  arch: string;
};

/**
 * Derive a canonical { os, arch } pair from a Bun target string such as
 * "bun-windows-x64-modern" or "bun-linux-arm64".
 * Returns { os: process.platform, arch: process.arch } when `t` is null/undefined.
 */
export function parseTarget(t: string | null | undefined): ParsedTarget {
  if (!t)
    return {
      os: process.platform,
      arch: process.arch === "x64" ? "x64" : process.arch,
    };

  const s = t.replace(/^bun-/, "");

  if (s.startsWith("linux-x64-baseline")) return { os: "linux", arch: "x64-baseline" };
  if (s.startsWith("linux-x64")) return { os: "linux", arch: "x64" };
  if (s.startsWith("linux-arm64-musl")) return { os: "linux", arch: "arm64-musl" };
  if (s.startsWith("linux-arm64")) return { os: "linux", arch: "arm64" };
  if (s.startsWith("darwin-x64")) return { os: "darwin", arch: "x64" };
  if (s.startsWith("darwin-arm64")) return { os: "darwin", arch: "arm64" };
  if (s.startsWith("windows-x64-baseline")) return { os: "windows", arch: "x64-baseline" };
  if (s.startsWith("windows-x64-modern")) return { os: "windows", arch: "x64-modern" };
  if (s.startsWith("windows-x64")) return { os: "windows", arch: "x64" };
  if (s.startsWith("windows-arm64")) return { os: "windows", arch: "arm64" };

  return { os: process.platform, arch: process.arch };
}

/**
 * Returns true when the given os value targets Windows.
 */
export function isWindowsTarget(targetOs: string): boolean {
  return targetOs === "windows";
}

/**
 * Compute the output filename for the binary.
 *
 *   target=bun-linux-x64          → dist/github-code-search-linux-x64
 *   target=bun-windows-x64        → dist/github-code-search-windows-x64.exe
 *   target=bun-windows-x64-modern → dist/github-code-search-windows-x64-modern.exe
 *   target=null (native)          → dist/github-code-search
 */
export function getOutfile(targetOs: string, target: string | null): string {
  const ext = isWindowsTarget(targetOs) ? ".exe" : "";
  const suffix = target ? `-${target.replace(/^bun-/, "")}` : "";
  return `./dist/github-code-search${suffix}${ext}`;
}

export type WindowsMeta = {
  iconPath?: string;
  title?: string;
  publisher?: string;
  appVersion?: string;
  description?: string;
  copyright?: string;
};

/**
 * Build the `compile` options forwarded to Bun.build().
 * Windows binaries receive metadata-enriching flags so the resulting .exe
 * is not misidentified as "bun" by the OS and shows correct file properties.
 * See: https://bun.sh/docs/bundler/executables#windows-specific-flags
 *
 * @param meta.iconPath Absolute path to .ico — must be absolute so Bun
 *   resolves it correctly regardless of the caller's CWD.
 */
export function getBuildCompileOptions(
  targetOs: string,
  outfile: string,
  meta: WindowsMeta = {},
): NonNullable<Parameters<typeof Bun.build>[0]["compile"]> {
  if (isWindowsTarget(targetOs)) {
    return {
      outfile,
      windows: {
        // iconPath must be absolute — relative paths are resolved from the
        // process CWD which may differ from the script location.
        icon: meta.iconPath,
        // hideConsole: true — prevents Windows from spawning a detached console
        // window when the binary is launched from a GUI context (e.g. Explorer).
        // The binary still runs correctly in any terminal emulator / cmd / pwsh.
        hideConsole: true,
        title: meta.title,
        publisher: meta.publisher,
        version: meta.appVersion,
        description: meta.description,
        copyright: meta.copyright,
      },
    };
  }
  return { outfile };
}

// ─── CLI args ─────────────────────────────────────────────────────────────────

const targetArg = process.argv.find((a) => a.startsWith("--target="));
const target = targetArg?.slice("--target=".length) ?? null;

// ─── Derive OS / arch from target ────────────────────────────────────────────

const { os: targetOs, arch: targetArch } = parseTarget(target);

// ─── Output path ─────────────────────────────────────────────────────────────

const outfile = getOutfile(targetOs, target);

// ─── Git commit hash ─────────────────────────────────────────────────────────

let commit = "dev";
try {
  const proc = Bun.spawn(["git", "rev-parse", "--short", "HEAD"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.exited;
  commit = (await new Response(proc.stdout).text()).trim() || "dev";
} catch {
  // Not a git repo or git not available
}

// ─── Build ────────────────────────────────────────────────────────────────────

const label = `${version} (${commit} · ${targetOs}/${targetArch})`;
console.log(`Building github-code-search v${label}… outfile=${outfile}`);
if (target) console.log(`  Target: ${target}`);

// Absolute path to the Windows icon — must be absolute so Bun resolves it
// correctly when the script is invoked from any working directory.
const icoPath = `${import.meta.dir}/docs/public/icons/favicon.ico`;

const currentYear = new Date().getFullYear();

await Bun.$`mkdir -p dist`;
await Bun.build({
  entrypoints: ["./github-code-search.ts"],
  minify: true,
  // Fix: bytecode: true causes the binary to fail on Windows — removed.
  compile: getBuildCompileOptions(targetOs, outfile, {
    iconPath: icoPath,
    title: "github-code-search",
    publisher: typeof author === "string" ? author : author.name,
    appVersion: version,
    description,
    copyright: `Copyright © ${currentYear} ${typeof author === "string" ? author : author.name} — ${license}`,
  }),
  define: {
    BUILD_VERSION: JSON.stringify(version),
    BUILD_COMMIT: JSON.stringify(commit),
    BUILD_TARGET_OS: JSON.stringify(targetOs),
    BUILD_TARGET_ARCH: JSON.stringify(targetArch),
  },
  target: target ? (target as Parameters<typeof Bun.build>[0]["target"]) : undefined,
});

console.log(`  Built ${outfile}`);

// ─── Ad-hoc codesign (macOS only) ─────────────────────────────────────────────

if (targetOs === "darwin" && process.platform === "darwin") {
  const sign = Bun.spawn(
    [
      "codesign",
      "--deep",
      "--force",
      "--sign",
      "-",
      "--entitlements",
      `${import.meta.dir}/entitlements.plist`,
      outfile,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  const signCode = await sign.exited;
  if (signCode !== 0) {
    console.error(`codesign failed (exit ${signCode})`);
    process.exit(signCode);
  }
  console.log(`  Codesigned ${outfile}`);

  const verify = Bun.spawn(["codesign", "--verify", "--verbose", outfile], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const verifyCode = await verify.exited;
  if (verifyCode !== 0) {
    console.error(`codesign verification failed (exit ${verifyCode})`);
    process.exit(verifyCode);
  }
}
