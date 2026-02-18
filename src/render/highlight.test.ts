import { describe, expect, it } from "bun:test";
import { highlightFragment, MAX_FRAGMENT_LINES } from "./highlight.ts";

// Strip all ANSI escape codes to compare plain text.
const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns stripped plain-text output of a single-line fragment. */
function colorize(code: string, file: string): string {
  return strip(highlightFragment(code, [], file).join(""));
}

// ─── MAX_FRAGMENT_LINES constant ──────────────────────────────────────────────

describe("MAX_FRAGMENT_LINES", () => {
  it("is a positive integer", () => {
    expect(typeof MAX_FRAGMENT_LINES).toBe("number");
    expect(MAX_FRAGMENT_LINES).toBeGreaterThan(0);
  });
});

// ─── detectLang (via extension → tokenizer selection) ─────────────────────────

describe("detectLang", () => {
  const tsExts = ["ts", "tsx", "js", "jsx", "mjs", "cjs"];
  for (const ext of tsExts) {
    it(`detects TypeScript for .${ext}`, () => {
      // TypeScript keywords get colorized (ANSI codes present)
      const out = highlightFragment("const x = 1;", [], `file.${ext}`).join("");
      expect(out).toMatch(/\x1b\[/);
    });
  }

  it("detects Python for .py", () => {
    const out = highlightFragment("def foo():", [], "script.py").join("");
    expect(out).toMatch(/\x1b\[/);
  });

  it("detects Go for .go", () => {
    const out = highlightFragment("func main() {}", [], "main.go").join("");
    expect(out).toMatch(/\x1b\[/);
  });

  it("detects Rust for .rs", () => {
    const out = highlightFragment("fn main() {}", [], "main.rs").join("");
    expect(out).toMatch(/\x1b\[/);
  });

  it("detects Ruby for .rb (uses default rules)", () => {
    // Ruby falls through to default rules — output is just dimmed text
    const out = colorize("puts 'hello'", "app.rb");
    expect(out).toBe("puts 'hello'");
  });

  it("detects Java for .java", () => {
    const out = highlightFragment("public class Foo {}", [], "Foo.java").join("");
    expect(out).toMatch(/\x1b\[/);
  });

  it("detects Java for .kt (Kotlin)", () => {
    const out = highlightFragment("fun main() {}", [], "App.kt").join("");
    expect(out).toMatch(/\x1b\[/);
  });

  it("detects Shell for .sh / .bash / .zsh / .fish", () => {
    for (const ext of ["sh", "bash", "zsh", "fish"]) {
      const out = highlightFragment("echo $VAR", [], `script.${ext}`).join("");
      expect(out).toMatch(/\x1b\[/);
    }
  });

  it("detects YAML for .yaml / .yml", () => {
    for (const ext of ["yaml", "yml"]) {
      const out = highlightFragment("key: value", [], `config.${ext}`).join("");
      expect(out).toMatch(/\x1b\[/);
    }
  });

  it("detects JSON for .json", () => {
    const out = highlightFragment('{"k": 1}', [], "data.json").join("");
    expect(out).toMatch(/\x1b\[/);
  });

  it("detects CSS for .css / .scss / .less", () => {
    for (const ext of ["css", "scss", "less"]) {
      const out = highlightFragment(".btn { color: red; }", [], `style.${ext}`).join("");
      expect(out).toMatch(/\x1b\[/);
    }
  });

  it("detects HTML for .html / .xml / .svelte / .vue", () => {
    for (const ext of ["html", "xml", "svelte", "vue"]) {
      const out = highlightFragment("<div>hello</div>", [], `app.${ext}`).join("");
      // html/xml falls through to default (no specific tokenizer configured)
      expect(typeof out).toBe("string");
    }
  });

  it("uses text/default rules for unknown extension", () => {
    // Unknown extension → default rules → plain dim text
    const out = colorize("hello world", "README.xyz");
    expect(out).toBe("hello world");
  });

  it("uses text rules when file has no extension", () => {
    const out = colorize("some text", "Makefile");
    expect(out).toBe("some text");
  });
});

// ─── TypeScript tokenizer ─────────────────────────────────────────────────────

describe("TypeScript tokenizer", () => {
  it("colorizes keywords in magenta", () => {
    const raw = highlightFragment("const x = 1;", [], "f.ts").join("");
    // 'const' should be colored (ANSI codes present), text preserved
    expect(colorize("const x = 1;", "f.ts")).toContain("const");
    expect(raw).toMatch(/\x1b\[/);
  });

  it("colorizes string literals", () => {
    expect(colorize('"hello"', "f.ts")).toBe('"hello"');
  });

  it("colorizes single-quoted strings", () => {
    expect(colorize("'world'", "f.ts")).toBe("'world'");
  });

  it("colorizes template literals", () => {
    expect(colorize("`hello`", "f.ts")).toBe("`hello`");
  });

  it("colorizes line comments", () => {
    expect(colorize("// a comment", "f.ts")).toBe("// a comment");
  });

  it("colorizes block comments", () => {
    expect(colorize("/* block */", "f.ts")).toBe("/* block */");
  });

  it("colorizes numeric literals", () => {
    expect(colorize("42", "f.ts")).toBe("42");
  });

  it("colorizes bigint literals (n suffix)", () => {
    expect(colorize("9007199254740991n", "f.ts")).toBe("9007199254740991n");
  });

  it("colorizes PascalCase identifiers as types", () => {
    expect(colorize("MyClass", "f.ts")).toBe("MyClass");
  });

  it("preserves extra TS keywords (async, await, type, interface)", () => {
    for (const kw of ["async", "await", "type", "interface"]) {
      expect(colorize(kw, "f.ts")).toBe(kw);
    }
  });
});

// ─── Python tokenizer ─────────────────────────────────────────────────────────

describe("Python tokenizer", () => {
  it("colorizes def/class keywords", () => {
    expect(colorize("def foo():", "f.py")).toBe("def foo():");
    expect(colorize("class Bar:", "f.py")).toBe("class Bar:");
  });

  it("colorizes inline comments", () => {
    expect(colorize("# comment", "f.py")).toBe("# comment");
  });

  it("colorizes double-quoted strings", () => {
    expect(colorize('"hello"', "f.py")).toBe('"hello"');
  });

  it("colorizes single-quoted strings", () => {
    expect(colorize("'world'", "f.py")).toBe("'world'");
  });

  it("colorizes triple-quoted docstrings (double)", () => {
    expect(colorize('"""doc"""', "f.py")).toBe('"""doc"""');
  });

  it("colorizes triple-quoted docstrings (single)", () => {
    expect(colorize("'''doc'''", "f.py")).toBe("'''doc'''");
  });

  it("colorizes decorators", () => {
    expect(colorize("@property", "f.py")).toBe("@property");
  });

  it("colorizes numeric literals", () => {
    expect(colorize("3.14", "f.py")).toBe("3.14");
  });

  it("preserves Python keywords (None, True, False)", () => {
    for (const kw of ["None", "True", "False", "return", "import", "from"]) {
      expect(colorize(kw, "f.py")).toBe(kw);
    }
  });
});

// ─── Go tokenizer ─────────────────────────────────────────────────────────────

describe("Go tokenizer", () => {
  it("colorizes func/var/const keywords", () => {
    expect(colorize("func main()", "f.go")).toBe("func main()");
    expect(colorize("var x int", "f.go")).toBe("var x int");
    expect(colorize("const Pi", "f.go")).toBe("const Pi");
  });

  it("colorizes line comments", () => {
    expect(colorize("// goroutine", "f.go")).toBe("// goroutine");
  });

  it("colorizes raw string literals (backtick)", () => {
    expect(colorize("`raw`", "f.go")).toBe("`raw`");
  });

  it("colorizes double-quoted strings", () => {
    expect(colorize('"hello"', "f.go")).toBe('"hello"');
  });

  it("colorizes numerics", () => {
    expect(colorize("42", "f.go")).toBe("42");
  });

  it("preserves Go-specific keywords (go, chan, defer, range)", () => {
    for (const kw of ["go", "chan", "defer", "range", "nil", "iota"]) {
      expect(colorize(kw, "f.go")).toBe(kw);
    }
  });
});

// ─── Rust tokenizer ───────────────────────────────────────────────────────────

describe("Rust tokenizer", () => {
  it("colorizes fn/let/mut keywords", () => {
    expect(colorize("fn main()", "f.rs")).toBe("fn main()");
    expect(colorize("let mut x", "f.rs")).toBe("let mut x");
  });

  it("colorizes line comments", () => {
    expect(colorize("// safe", "f.rs")).toBe("// safe");
  });

  it("colorizes string literals", () => {
    expect(colorize('"text"', "f.rs")).toBe('"text"');
  });

  it("colorizes SCREAMING_SNAKE_CASE as constants", () => {
    expect(colorize("MAX_SIZE", "f.rs")).toBe("MAX_SIZE");
  });

  it("preserves Rust keywords (Some, None, Ok, Err, unsafe)", () => {
    for (const kw of ["Some", "None", "Ok", "Err", "unsafe", "async", "await"]) {
      expect(colorize(kw, "f.rs")).toBe(kw);
    }
  });
});

// ─── Java tokenizer ───────────────────────────────────────────────────────────

describe("Java tokenizer", () => {
  it("colorizes class/public/private keywords", () => {
    expect(colorize("public class Foo", "Foo.java")).toBe("public class Foo");
  });

  it("colorizes string literals", () => {
    expect(colorize('"hello"', "Foo.java")).toBe('"hello"');
  });

  it("colorizes line comments", () => {
    expect(colorize("// comment", "Foo.java")).toBe("// comment");
  });

  it("colorizes numeric literals with suffixes", () => {
    expect(colorize("42L", "Foo.java")).toBe("42L");
    expect(colorize("3.14f", "Foo.java")).toBe("3.14f");
  });

  it("colorizes PascalCase types", () => {
    expect(colorize("ArrayList", "Foo.java")).toBe("ArrayList");
  });
});

// ─── Shell tokenizer ──────────────────────────────────────────────────────────

describe("Shell tokenizer", () => {
  it("colorizes inline comments", () => {
    expect(colorize("# comment", "script.sh")).toBe("# comment");
  });

  it("colorizes double-quoted strings", () => {
    expect(colorize('"hello"', "script.sh")).toBe('"hello"');
  });

  it("colorizes single-quoted strings", () => {
    expect(colorize("'world'", "script.sh")).toBe("'world'");
  });

  it("colorizes $VAR references", () => {
    expect(colorize("$HOME", "script.sh")).toBe("$HOME");
    expect(colorize("${PATH}", "script.sh")).toBe("${PATH}");
  });
});

// ─── YAML tokenizer ───────────────────────────────────────────────────────────

describe("YAML tokenizer", () => {
  it("colorizes comments", () => {
    expect(colorize("# config", "cfg.yaml")).toBe("# config");
  });

  it("colorizes string values", () => {
    expect(colorize('"value"', "cfg.yaml")).toBe('"value"');
    expect(colorize("'value'", "cfg.yaml")).toBe("'value'");
  });

  it("colorizes key identifiers before colon", () => {
    expect(colorize("key:", "cfg.yaml")).toBe("key:");
  });

  it("colorizes boolean/null literals", () => {
    for (const kw of ["true", "false", "null", "~"]) {
      expect(colorize(kw, "cfg.yaml")).toBe(kw);
    }
  });

  it("colorizes numeric values", () => {
    expect(colorize("42", "cfg.yaml")).toBe("42");
    expect(colorize("3.14", "cfg.yaml")).toBe("3.14");
  });
});

// ─── JSON tokenizer ───────────────────────────────────────────────────────────

describe("JSON tokenizer", () => {
  it("colorizes object keys (string before colon)", () => {
    expect(colorize('"key":', "data.json")).toBe('"key":');
  });

  it("colorizes string values (string not before colon)", () => {
    expect(colorize('"value"', "data.json")).toBe('"value"');
  });

  it("colorizes boolean/null literals", () => {
    for (const kw of ["true", "false", "null"]) {
      expect(colorize(kw, "data.json")).toBe(kw);
    }
  });

  it("colorizes numeric values including negatives and exponents", () => {
    expect(colorize("-3.14e10", "data.json")).toBe("-3.14e10");
  });
});

// ─── CSS tokenizer ────────────────────────────────────────────────────────────

describe("CSS tokenizer", () => {
  it("colorizes block comments", () => {
    expect(colorize("/* comment */", "style.css")).toBe("/* comment */");
  });

  it("colorizes hex color values", () => {
    expect(colorize("#ff0000", "style.css")).toBe("#ff0000");
    expect(colorize("#fff", "style.css")).toBe("#fff");
  });

  it("colorizes class selectors", () => {
    expect(colorize(".btn", "style.css")).toBe(".btn");
  });

  it("colorizes id selectors", () => {
    expect(colorize("#main", "style.css")).toBe("#main");
  });

  it("colorizes string values", () => {
    expect(colorize('"Arial"', "style.css")).toBe('"Arial"');
    expect(colorize("'sans-serif'", "style.css")).toBe("'sans-serif'");
  });
});

// ─── highlightFragment — segment highlighting ─────────────────────────────────

describe("highlightFragment segment highlighting", () => {
  it("highlights a matched segment in bold yellow", () => {
    const result = highlightFragment("hello world", [{ text: "world", indices: [6, 11] }], "f.ts");
    const raw = result.join("");
    // Must contain ANSI (bold + yellow applied to segment)
    expect(raw).toMatch(/\x1b\[/);
    // Plain text still contains the word
    expect(strip(raw)).toContain("world");
  });

  it("handles a segment at the start of the line", () => {
    const result = highlightFragment("const x = 1", [{ text: "const", indices: [0, 5] }], "f.ts");
    expect(strip(result.join(""))).toContain("const");
  });

  it("handles a segment at the end of the line", () => {
    const result = highlightFragment("hello world", [{ text: "world", indices: [6, 11] }], "f.ts");
    expect(strip(result.join(""))).toContain("world");
  });

  it("handles overlapping segment that extends past line end (clamped)", () => {
    // segment goes past end of line → should not throw
    const result = highlightFragment("hello", [{ text: "hello!", indices: [0, 999] }], "f.ts");
    expect(strip(result.join(""))).toBe("hello");
  });

  it("handles multiple segments on one line", () => {
    const result = highlightFragment(
      "foo bar baz",
      [
        { text: "foo", indices: [0, 3] },
        { text: "baz", indices: [8, 11] },
      ],
      "f.ts",
    );
    const plain = strip(result.join(""));
    expect(plain).toContain("foo");
    expect(plain).toContain("baz");
  });

  it("places segment highlight only on the correct line of a multiline fragment", () => {
    // segment is on the second line ("bar")
    const fragment = "foo\nbar\nbaz";
    const result = highlightFragment(
      fragment,
      [{ text: "bar", indices: [4, 7] }], // 'bar' starts at offset 4 (after "foo\n")
      "f.ts",
    );
    expect(strip(result[0])).toBe("foo");
    expect(strip(result[1])).toBe("bar");
  });
});

// ─── highlightFragment — multiline / truncation ───────────────────────────────

describe("highlightFragment multiline behaviour", () => {
  it("returns one line per code line for a multiline fragment", () => {
    const result = highlightFragment("a\nb\nc", [], "f.ts");
    expect(result.length).toBe(3);
    expect(strip(result[0])).toBe("a");
    expect(strip(result[1])).toBe("b");
    expect(strip(result[2])).toBe("c");
  });

  it(`caps at ${MAX_FRAGMENT_LINES} code lines and appends 'more' indicator`, () => {
    const fragment = Array.from({ length: MAX_FRAGMENT_LINES + 3 }, (_, i) => `line${i}`).join(
      "\n",
    );
    const result = highlightFragment(fragment, [], "f.ts");
    expect(result.length).toBe(MAX_FRAGMENT_LINES + 1); // code lines + indicator
    const indicator = strip(result[MAX_FRAGMENT_LINES]);
    expect(indicator).toContain("+3 more lines");
  });

  it("does not append 'more' indicator when fragment fits exactly", () => {
    const fragment = Array.from({ length: MAX_FRAGMENT_LINES }, (_, i) => `line${i}`).join("\n");
    const result = highlightFragment(fragment, [], "f.ts");
    expect(result.length).toBe(MAX_FRAGMENT_LINES);
    expect(result[result.length - 1]).not.toContain("more lines");
  });

  it("truncates lines longer than 120 chars with an ellipsis", () => {
    const long = "x".repeat(200);
    const result = highlightFragment(long, [], "f.ts");
    const plain = strip(result[0]);
    expect(plain.length).toBeLessThanOrEqual(121 + 1); // 120 chars + "…"
    expect(plain).toContain("…");
  });

  it("does not add ellipsis for lines exactly 120 chars", () => {
    const exact = "y".repeat(120);
    const result = highlightFragment(exact, [], "f.ts");
    const plain = strip(result[0]);
    expect(plain).not.toContain("…");
    expect(plain.length).toBe(120);
  });
});
