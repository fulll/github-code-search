---
applyTo: "src/**/*.ts,github-code-search.ts"
---

# Terminal controls and redraw safety

- Read `AGENTS.md` and search `src/terminal-control.ts` before adding terminal controls.
  Reuse named constants instead of duplicating encoded ANSI, keyboard or mouse bytes.
  Add a missing control once in that module; use `cursorPosition()` for coordinates.
- In terminal output and new tests, compose `LINE_FEED`, `CARRIAGE_RETURN` and `TAB`
  rather than embedding encoded line breaks or long protocol strings.
  Preserve existing key-binding names when extracting them to shared vocabulary.
- Use `src/style.ts` for standard text styling. Named custom-colour/reset constants
  are for the existing protocol-level rendering, not a second styling framework.
- Normalize carriage returns and tabs before clipping or comparing differential
  frames. Measure visible columns through `render/terminal.ts`, ignoring SGR bytes.
  A tab must overwrite skipped cells with spaces, not retain old text/highlights.
- Do not append a tail erase to an exactly full-width line: it erases the final
  cell, including the edge of a wide glyph. Preserve unchanged rows and submit
  changed frames in one write.
- Add failing regressions before fixes. Assert resulting terminal cells for CRLF,
  tab-indented scrolling and full-width ASCII/wide-glyph lines; string-sequence
  assertions alone do not prove terminal correctness.
- Keep the read-only architecture guard in `src/terminal-control.test.ts` passing
  through the normal `bun test` suite. New render modules are covered automatically;
  add other new terminal emitters to its surface set. Do not exempt production code.
  Independent vocabulary wire-format tests, existing legacy protocol fixtures and
  syntax-parsing regexes may contain literal encodings; new frame tests may not.
- Run `bun test --dots`, `bun run typecheck`, `bun run format:check`,
  `bun run knip` and `bun run build.ts` before publishing changes.
