// ─── gh CLI token fallback ─────────────────────────────────────────────────────
//
// Fallback for GITHUB_TOKEN: when the env var isn't set, detect whether the
// GitHub CLI (`gh`) is installed and, if so, retrieve a token via
// `gh auth token`. Pure decision logic lives in `resolveGhAuthToken` (unit
// tested via injected `which`/`runAuthToken`); `getGhAuthToken` is the sole
// call site for the real `Bun.which` / subprocess spawn, tested by
// reassigning those globals rather than spawning a real `gh` process.

/** Result of a single subprocess invocation, abstracted for testability. */
export interface ExecResult {
  exitCode: number;
  stdout: string;
}

/**
 * Returns the token from `gh auth token` when `gh` is installed and the
 * command succeeds with non-empty output, `undefined` otherwise (not
 * installed, non-zero exit code, or blank output). Pure — `which` and
 * `runAuthToken` are injected so this can be unit tested without spawning a
 * real subprocess.
 */
export function resolveGhAuthToken(
  which: (cmd: string) => boolean,
  runAuthToken: () => ExecResult,
): string | undefined {
  if (!which("gh")) return undefined;
  const result = runAuthToken();
  if (result.exitCode !== 0) return undefined;
  const token = result.stdout.trim();
  return token.length > 0 ? token : undefined;
}

/**
 * Real Bun call site: checks for `gh` on PATH and, if present, runs
 * `gh auth token` synchronously to retrieve a token.
 */
export function getGhAuthToken(): string | undefined {
  return resolveGhAuthToken(
    (cmd) => Bun.which(cmd) !== null,
    () => {
      const proc = Bun.spawnSync(["gh", "auth", "token"]);
      return { exitCode: proc.exitCode, stdout: proc.stdout.toString() };
    },
  );
}
