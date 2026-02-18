/**
 * Bun test preload – runs before any test module is imported.
 *
 * Forces picocolors to emit ANSI codes regardless of whether stdout is a TTY
 * (e.g. when piped to `tee` in CI). Without this, the two `highlightFragment`
 * tests that assert on ANSI escape sequences fail whenever stdout is a pipe.
 */
process.env.FORCE_COLOR = "1";
