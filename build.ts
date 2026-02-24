#!/usr/bin/env bun
/**
 * Build script – compiles github-code-search.ts into a standalone binary.
 *
 * Usage:
 *   bun run build.ts.ts                            # current platform
 *   bun run build.ts.ts --target=bun-linux-x64     # cross-compile
 *
 * Supported targets (Bun executables):
 *   bun-linux-x64  bun-linux-x64-baseline  bun-linux-arm64
 *   bun-darwin-x64  bun-darwin-arm64
 *   bun-windows-x64
 */

import { version } from "./package.json" with { type: "json" };

// ─── CLI args ──────────────────────────────────────────────────────────────────

const targetArg = process.argv.find((a) => a.startsWith("--target="));
const target = targetArg?.slice("--target=".length) ?? null;

// ─── Derive OS / arch from target ─────────────────────────────────────────────

function parseTarget(t: string): { os: string; arch: string } {
  const s = t.replace(/^bun-/, "");
  if (s.startsWith("linux-x64-baseline")) return { os: "linux", arch: "x64-baseline" };
  if (s.startsWith("linux-x64")) return { os: "linux", arch: "x64" };
  if (s.startsWith("linux-arm64-musl")) return { os: "linux", arch: "arm64-musl" };
  if (s.startsWith("linux-arm64")) return { os: "linux", arch: "arm64" };
  if (s.startsWith("darwin-x64")) return { os: "darwin", arch: "x64" };
  if (s.startsWith("darwin-arm64")) return { os: "darwin", arch: "arm64" };
  if (s.startsWith("windows-x64")) return { os: "windows", arch: "x64" };
  return { os: process.platform, arch: process.arch };
}

const { os: targetOs, arch: targetArch } = target
  ? parseTarget(target)
  : {
      os: process.platform,
      arch: process.arch === "x64" ? "x64" : process.arch,
    };

// ─── Output path ───────────────────────────────────────────────────────────────

const ext = targetOs === "windows" ? ".exe" : "";
const suffix = target ? `-${target.replace(/^bun-/, "")}` : "";
const outfile = `./dist/github-code-search${suffix}${ext}`;

// ─── Git commit hash ──────────────────────────────────────────────────────────

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

await Bun.$`mkdir -p dist`;
await Bun.build({
  entrypoints: ["./github-code-search.ts"],
  minify: true,
  bytecode: true,
  compile: {
    outfile,
  },
  define: {
    BUILD_VERSION: JSON.stringify(version),
    BUILD_COMMIT: JSON.stringify(commit),
    BUILD_TARGET_OS: JSON.stringify(targetOs),
    BUILD_TARGET_ARCH: JSON.stringify(targetArch),
  },
  target: target ? target : undefined,
});

console.log(`  Built ${outfile}`);

// ─── Ad-hoc codesign (macOS only) ────────────────────────────────────────────

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
