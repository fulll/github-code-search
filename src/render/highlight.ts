import * as style from "../style.ts";
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
  | "php"
  | "c"
  | "swift"
  | "terraform"
  | "dockerfile"
  | "text";

function detectLang(filePath: string): Lang {
  // Extension-based detection takes priority to avoid false positives
  // (e.g. Dockerfile.ts must be detected as typescript, not dockerfile).
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
    php: "php",
    phtml: "php",
    c: "c",
    h: "c",
    cpp: "c",
    cc: "c",
    cxx: "c",
    hpp: "c",
    hxx: "c",
    swift: "swift",
    tf: "terraform",
    hcl: "terraform",
  };
  const langFromExt = map[ext];
  if (langFromExt) return langFromExt;

  // Dockerfile detection by filename — only reached when no extension matched,
  // so Dockerfile.ts / Dockerfile.php are never misidentified.
  const base = filePath.split("/").pop() ?? "";
  const baseLower = base.toLowerCase();
  if (baseLower === "dockerfile" || baseLower.startsWith("dockerfile.")) {
    return "dockerfile";
  }

  return "text";
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
const PHP_KW =
  /^(?:function|class|return|echo|print|if|elseif|else|while|for|foreach|as|do|switch|case|default|break|continue|new|null|true|false|this|self|static|public|private|protected|extends|implements|interface|abstract|final|try|catch|finally|throw|use|namespace|trait|match|fn|array|list|isset|empty|unset|include|require|include_once|require_once|and|or|not|instanceof)\b/;
const C_KW =
  /^(?:int|void|char|float|double|long|short|unsigned|signed|struct|union|enum|typedef|const|static|extern|auto|register|volatile|inline|return|if|else|while|for|do|switch|case|default|break|continue|goto|sizeof|nullptr|true|false|class|public|private|protected|virtual|new|delete|this|namespace|template|using|operator|override|final|explicit|mutable|friend|try|catch|throw|decltype|constexpr|noexcept)\b/;
const SWIFT_KW =
  /^(?:var|let|func|class|struct|enum|protocol|extension|import|return|if|else|for|while|repeat|switch|case|default|break|continue|guard|in|where|nil|true|false|self|super|init|deinit|throws|throw|rethrows|try|catch|async|await|actor|some|typealias|override|final|open|public|internal|private|fileprivate|static|mutating|nonmutating|lazy|weak|unowned|inout|defer)\b/;
const TF_KW =
  /^(?:resource|variable|output|module|provider|terraform|locals|data|backend|required_providers|required_version|for_each|count|depends_on|lifecycle|provisioner|connection)\b/;

const DOCKERFILE_INSTR =
  /^(?:FROM|RUN|CMD|LABEL|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL|MAINTAINER)\b/;

const tokenRules: Partial<Record<Lang, TokenRule[]>> & {
  default: TokenRule[];
} = {
  typescript: [
    [/^\/\/[^\n]*/, (s) => style.dim(s)],
    [/^\/\*[\s\S]*?\*\//, (s) => style.dim(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => style.green(s)],
    [/^'(?:[^'\\]|\\.)*'/, (s) => style.green(s)],
    [/^`(?:[^`\\]|\\.)*`/, (s) => style.green(s)],
    [TS_KW, (s) => style.magenta(s)],
    [/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?n?/, (s) => style.yellow(s)],
    [/^[A-Z][a-zA-Z0-9_$]*/, (s) => style.cyan(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => style.dim(s)],
  ],
  python: [
    [/^#[^\n]*/, (s) => style.dim(s)],
    [/^"""[\s\S]*?"""/, (s) => style.green(s)],
    [/^'''[\s\S]*?'''/, (s) => style.green(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => style.green(s)],
    [/^'(?:[^'\\]|\\.)*'/, (s) => style.green(s)],
    [/^@[a-zA-Z_]\w*/, (s) => style.cyan(s)],
    [PY_KW, (s) => style.magenta(s)],
    [/^\d+(?:\.\d+)?/, (s) => style.yellow(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => style.dim(s)],
  ],
  go: [
    [/^\/\/[^\n]*/, (s) => style.dim(s)],
    [/^\/\*[\s\S]*?\*\//, (s) => style.dim(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => style.green(s)],
    [/^`[^`]*`/, (s) => style.green(s)],
    [GO_KW, (s) => style.magenta(s)],
    [/^\d+(?:\.\d+)?/, (s) => style.yellow(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => style.dim(s)],
  ],
  rust: [
    [/^\/\/[^\n]*/, (s) => style.dim(s)],
    [/^\/\*[\s\S]*?\*\//, (s) => style.dim(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => style.green(s)],
    [RS_KW, (s) => style.magenta(s)],
    [/^\d+(?:\.\d+)?/, (s) => style.yellow(s)],
    [/^[A-Z][A-Z0-9_]+\b/, (s) => style.cyan(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => style.dim(s)],
  ],
  java: [
    [/^\/\/[^\n]*/, (s) => style.dim(s)],
    [/^\/\*[\s\S]*?\*\//, (s) => style.dim(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => style.green(s)],
    [JAVA_KW, (s) => style.magenta(s)],
    [/^\d+(?:\.\d+)?[LlFfDd]?/, (s) => style.yellow(s)],
    [/^[A-Z][a-zA-Z0-9_]*/, (s) => style.cyan(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => style.dim(s)],
  ],
  shell: [
    [/^#[^\n]*/, (s) => style.dim(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => style.green(s)],
    [/^'[^']*'/, (s) => style.green(s)],
    [/^\$\{?[a-zA-Z_]\w*\}?/, (s) => style.cyan(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => style.dim(s)],
  ],
  yaml: [
    [/^#[^\n]*/, (s) => style.dim(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => style.green(s)],
    [/^'[^']*'/, (s) => style.green(s)],
    [/^[a-zA-Z_][\w-]*(?=\s*:)/, (s) => style.cyan(s)],
    [/^(?:true|false|null|~)\b/, (s) => style.magenta(s)],
    [/^\d+(?:\.\d+)?/, (s) => style.yellow(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => style.dim(s)],
  ],
  json: [
    [/^"(?:[^"\\]|\\.)*"\s*(?=:)/, (s) => style.cyan(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => style.green(s)],
    [/^(?:true|false|null)\b/, (s) => style.magenta(s)],
    [/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, (s) => style.yellow(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => style.dim(s)],
  ],
  css: [
    [/^\/\*[\s\S]*?\*\//, (s) => style.dim(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => style.green(s)],
    [/^'[^']*'/, (s) => style.green(s)],
    [/^#[a-fA-F0-9]{3,8}\b/, (s) => style.yellow(s)],
    [/^\.[a-zA-Z_-][\w-]*/, (s) => style.cyan(s)],
    [/^#[a-zA-Z_-][\w-]*/, (s) => style.magenta(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => style.dim(s)],
  ],
  default: [
    [/^\s+/, (s) => s],
    [/^./, (s) => style.dim(s)],
  ],
  php: [
    [/^\/\/[^\n]*/, (s) => style.dim(s)],
    // Fix: exclude PHP 8+ attribute syntax (#[Route(...)], #[ORM\Entity]) from being dimmed as comments
    [/^#(?!\[)[^\n]*/, (s) => style.dim(s)],
    [/^\/\*[\s\S]*?\*\//, (s) => style.dim(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => style.green(s)],
    [/^'(?:[^'\\]|\\.)*'/, (s) => style.green(s)],
    [/^\$[a-zA-Z_]\w*/, (s) => style.cyan(s)],
    [PHP_KW, (s) => style.magenta(s)],
    [/^\d+(?:\.\d+)?/, (s) => style.yellow(s)],
    [/^[A-Z][a-zA-Z0-9_]*/, (s) => style.cyan(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => style.dim(s)],
  ],
  c: [
    [/^\/\/[^\n]*/, (s) => style.dim(s)],
    [/^\/\*[\s\S]*?\*\//, (s) => style.dim(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => style.green(s)],
    [/^'(?:[^'\\]|\\.)*'/, (s) => style.green(s)],
    [
      /^#\s*(?:include|define|undef|ifdef|ifndef|endif|if|else|elif|pragma|error|warning)\b[^\n]*/,
      (s) => style.cyan(s),
    ],
    [C_KW, (s) => style.magenta(s)],
    [/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[uUlLfFdD]*/, (s) => style.yellow(s)],
    [/^[A-Z][A-Z0-9_]+\b/, (s) => style.cyan(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => style.dim(s)],
  ],
  swift: [
    [/^\/\/[^\n]*/, (s) => style.dim(s)],
    [/^\/\*[\s\S]*?\*\//, (s) => style.dim(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => style.green(s)],
    [SWIFT_KW, (s) => style.magenta(s)],
    [/^\d+(?:\.\d+)?/, (s) => style.yellow(s)],
    [/^[A-Z][a-zA-Z0-9_]*/, (s) => style.cyan(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => style.dim(s)],
  ],
  terraform: [
    [/^#[^\n]*/, (s) => style.dim(s)],
    [/^\/\/[^\n]*/, (s) => style.dim(s)],
    [/^\/\*[\s\S]*?\*\//, (s) => style.dim(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => style.green(s)],
    [TF_KW, (s) => style.magenta(s)],
    [/^(?:true|false|null)\b/, (s) => style.magenta(s)],
    [/^\d+(?:\.\d+)?/, (s) => style.yellow(s)],
    [/^[a-zA-Z_][\w-]*/, (s) => style.cyan(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => style.dim(s)],
  ],
  dockerfile: [
    [/^#[^\n]*/, (s) => style.dim(s)],
    [DOCKERFILE_INSTR, (s) => style.magenta(s)],
    [/^"(?:[^"\\]|\\.)*"/, (s) => style.green(s)],
    [/^\$\{?[a-zA-Z_]\w*\}?/, (s) => style.cyan(s)],
    [/^\s+/, (s) => s],
    [/^./, (s) => style.dim(s)],
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
      result += style.dim(rest[0]);
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
 *
 * @param maxLineChars - Maximum visible characters per line before truncation.
 *   Pass `termWidth - indent` so that rendered lines never wrap in the terminal.
 *   Defaults to MAX_LINE_CHARS (120) for callers that don't know termWidth.
 */
export function highlightFragment(
  fragment: string,
  segments: TextMatchSegment[],
  filePath: string,
  maxLineChars = MAX_LINE_CHARS,
): string[] {
  const lang = detectLang(filePath);
  const rawLines = fragment.split("\n");
  const result: string[] = [];
  let offset = 0;

  const linesToShow = Math.min(rawLines.length, MAX_FRAGMENT_LINES);

  for (let li = 0; li < linesToShow; li++) {
    const line = rawLines[li];
    const lineEnd = offset + line.length;
    const raw = line.length > maxLineChars ? line.slice(0, maxLineChars) + "…" : line;

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
      colored += style.style(["bold", "yellow"], raw.slice(seg.start, seg.end));
      pos = seg.end;
    }
    if (pos < raw.length) {
      colored += syntaxColor(raw.slice(pos), lang);
    }

    result.push(colored);
    offset += line.length + 1; // +1 for the consumed '\n'
  }

  if (rawLines.length > MAX_FRAGMENT_LINES) {
    result.push(style.dim(`… +${rawLines.length - MAX_FRAGMENT_LINES} more lines`));
  }

  return result;
}
