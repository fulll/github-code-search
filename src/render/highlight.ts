import pc from "picocolors";
import type { TextMatchSegment } from "../types.ts";

// ─── Language detection ───────────────────────────────────────────────────────

type Lang =
  | "typescript"
  | "python"
  | "go"
  | "rust"
  | "ruby"
  | "java"
  | "shell"
  | "yaml"
  | "json"
  | "css"
  | "html"
  | "text";

function detectLang(filePath: string): Lang {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, Lang> = {
    ts: "typescript",
    tsx: "typescript",
    js: "typescript",
    jsx: "typescript",
    mjs: "typescript",
    cjs: "typescript",
    py: "python",
    go: "go",
    rs: "rust",
    rb: "ruby",
    java: "java",
    kt: "java",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    fish: "shell",
    yaml: "yaml",
    yml: "yaml",
    json: "json",
    css: "css",
    scss: "css",
    less: "css",
    html: "html",
    xml: "html",
    svelte: "html",
    vue: "html",
  };
  return map[ext] ?? "text";
}

// ─── Syntax token rules ───────────────────────────────────────────────────────

type TokenRule = [RegExp, (s: string) => string];

const TS_KW =
  /^(?:const|let|var|function|class|import|export|from|as|return|if|else|while|for|do|switch|case|default|break|continue|new|typeof|instanceof|void|null|undefined|true|false|this|super|async|await|type|interface|extends|implements|public|private|protected|static|readonly|enum|namespace|declare|abstract|override|in|of|try|catch|finally|throw|delete|require|module)\b/;
const PY_KW =
  /^(?:def|class|import|from|as|return|if|elif|else|while|for|in|not|and|or|is|None|True|False|try|except|finally|raise|with|yield|lambda|pass|break|continue|global|nonlocal|del|assert|async|await)\b/;
const GO_KW =
  /^(?:func|var|const|type|struct|interface|import|package|return|if|else|for|range|switch|case|default|break|continue|go|chan|select|defer|map|make|new|nil|true|false|iota|fallthrough|goto)\b/;
const RS_KW =
  /^(?:fn|let|mut|const|static|struct|enum|trait|impl|use|mod|pub|crate|super|self|return|if|else|while|for|in|loop|match|break|continue|type|where|async|await|move|ref|dyn|unsafe|true|false|Some|None|Ok|Err)\b/;
const JAVA_KW =
  /^(?:public|private|protected|class|interface|enum|extends|implements|import|package|return|if|else|while|for|do|switch|case|default|break|continue|new|null|true|false|static|final|abstract|void|int|long|double|float|boolean|char|byte|short|try|catch|finally|throw|throws|instanceof|this|super|synchronized|volatile|transient|native|strictfp)\b/;

const tokenRules: Partial<Record<Lang, TokenRule[]>> & {
  default: TokenRule[];
} = {
  typescript: [
    [/^\/\/[^\n]*/, (s) => pc.dim(s)],
    [/^\/\*[\s\S]*?\*\//, (s) => pc.dim(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => pc.green(s)],
    [/^'(?:[^'\\]|\\.)*'/, (s) => pc.green(s)],
    [/^`(?:[^`\\]|\\.)*`/, (s) => pc.green(s)],
    [TS_KW, (s) => pc.magenta(s)],
    [/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?n?/, (s) => pc.yellow(s)],
    [/^[A-Z][a-zA-Z0-9_$]*/, (s) => pc.cyan(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => pc.dim(s)],
  ],
  python: [
    [/^#[^\n]*/, (s) => pc.dim(s)],
    [/^"""[\s\S]*?"""/, (s) => pc.green(s)],
    [/^'''[\s\S]*?'''/, (s) => pc.green(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => pc.green(s)],
    [/^'(?:[^'\\]|\\.)*'/, (s) => pc.green(s)],
    [/^@[a-zA-Z_]\w*/, (s) => pc.cyan(s)],
    [PY_KW, (s) => pc.magenta(s)],
    [/^\d+(?:\.\d+)?/, (s) => pc.yellow(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => pc.dim(s)],
  ],
  go: [
    [/^\/\/[^\n]*/, (s) => pc.dim(s)],
    [/^\/\*[\s\S]*?\*\//, (s) => pc.dim(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => pc.green(s)],
    [/^`[^`]*`/, (s) => pc.green(s)],
    [GO_KW, (s) => pc.magenta(s)],
    [/^\d+(?:\.\d+)?/, (s) => pc.yellow(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => pc.dim(s)],
  ],
  rust: [
    [/^\/\/[^\n]*/, (s) => pc.dim(s)],
    [/^\/\*[\s\S]*?\*\//, (s) => pc.dim(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => pc.green(s)],
    [RS_KW, (s) => pc.magenta(s)],
    [/^\d+(?:\.\d+)?/, (s) => pc.yellow(s)],
    [/^[A-Z][A-Z0-9_]+\b/, (s) => pc.cyan(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => pc.dim(s)],
  ],
  java: [
    [/^\/\/[^\n]*/, (s) => pc.dim(s)],
    [/^\/\*[\s\S]*?\*\//, (s) => pc.dim(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => pc.green(s)],
    [JAVA_KW, (s) => pc.magenta(s)],
    [/^\d+(?:\.\d+)?[LlFfDd]?/, (s) => pc.yellow(s)],
    [/^[A-Z][a-zA-Z0-9_]*/, (s) => pc.cyan(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => pc.dim(s)],
  ],
  shell: [
    [/^#[^\n]*/, (s) => pc.dim(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => pc.green(s)],
    [/^'[^']*'/, (s) => pc.green(s)],
    [/^\$\{?[a-zA-Z_]\w*\}?/, (s) => pc.cyan(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => pc.dim(s)],
  ],
  yaml: [
    [/^#[^\n]*/, (s) => pc.dim(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => pc.green(s)],
    [/^'[^']*'/, (s) => pc.green(s)],
    [/^[a-zA-Z_][\w-]*(?=\s*:)/, (s) => pc.cyan(s)],
    [/^(?:true|false|null|~)\b/, (s) => pc.magenta(s)],
    [/^\d+(?:\.\d+)?/, (s) => pc.yellow(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => pc.dim(s)],
  ],
  json: [
    [/^"(?:[^"\\]|\\.)*"\s*(?=:)/, (s) => pc.cyan(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => pc.green(s)],
    [/^(?:true|false|null)\b/, (s) => pc.magenta(s)],
    [/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, (s) => pc.yellow(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => pc.dim(s)],
  ],
  css: [
    [/^\/\*[\s\S]*?\*\//, (s) => pc.dim(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => pc.green(s)],
    [/^'[^']*'/, (s) => pc.green(s)],
    [/^#[a-fA-F0-9]{3,8}\b/, (s) => pc.yellow(s)],
    [/^\.[a-zA-Z_-][\w-]*/, (s) => pc.cyan(s)],
    [/^#[a-zA-Z_-][\w-]*/, (s) => pc.magenta(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => pc.dim(s)],
  ],
  default: [
    [/^\s+/, (s) => s],
    [/^./, (s) => pc.dim(s)],
  ],
};

/** Apply syntax coloring to a raw text span (no match highlights). */
function syntaxColor(text: string, lang: Lang): string {
  const rules = tokenRules[lang] ?? tokenRules.default;
  let result = "";
  let rest = text;
  while (rest.length > 0) {
    let matched = false;
    for (const [re, fn] of rules) {
      const m = re.exec(rest);
      if (m) {
        result += fn(m[0]);
        rest = rest.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      result += pc.dim(rest[0]);
      rest = rest.slice(1);
    }
  }
  return result;
}

// ─── Fragment highlighting (multiline) ───────────────────────────────────────

export const MAX_FRAGMENT_LINES = 6;
const MAX_LINE_CHARS = 120;

/**
 * Formats a code fragment into an array of terminal lines.
 * - Preserves newlines (each code line → one terminal line).
 * - Applies language-aware syntax coloring.
 * - Overlays bold-yellow highlights for matched segments.
 */
export function highlightFragment(
  fragment: string,
  segments: TextMatchSegment[],
  filePath: string,
): string[] {
  const lang = detectLang(filePath);
  const rawLines = fragment.split("\n");
  const result: string[] = [];
  let offset = 0;

  const linesToShow = Math.min(rawLines.length, MAX_FRAGMENT_LINES);

  for (let li = 0; li < linesToShow; li++) {
    const line = rawLines[li];
    const lineEnd = offset + line.length;
    const raw = line.length > MAX_LINE_CHARS ? line.slice(0, MAX_LINE_CHARS) + "…" : line;

    // Find segments that overlap this line, adjusted to line-local offsets
    const localSegs = segments
      .filter((s) => s.indices[0] < lineEnd && s.indices[1] > offset)
      .map((s) => ({
        start: Math.max(0, s.indices[0] - offset),
        end: Math.min(raw.length, s.indices[1] - offset),
      }))
      .toSorted((a, b) => a.start - b.start);

    // Build colored line: split into alternating non-match / match spans
    let colored = "";
    let pos = 0;
    for (const seg of localSegs) {
      if (seg.start > pos) {
        colored += syntaxColor(raw.slice(pos, seg.start), lang);
      }
      colored += pc.bold(pc.yellow(raw.slice(seg.start, seg.end)));
      pos = seg.end;
    }
    if (pos < raw.length) {
      colored += syntaxColor(raw.slice(pos), lang);
    }

    result.push(colored);
    offset += line.length + 1; // +1 for the consumed '\n'
  }

  if (rawLines.length > MAX_FRAGMENT_LINES) {
    result.push(pc.dim(`… +${rawLines.length - MAX_FRAGMENT_LINES} more lines`));
  }

  return result;
}
