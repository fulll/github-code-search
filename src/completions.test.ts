import { beforeEach, afterEach, describe, expect, it } from "bun:test";
import { generateCompletion, detectShell, getCompletionFilePath } from "./completions.ts";

// ─── generateCompletion ───────────────────────────────────────────────────────

describe("generateCompletion", () => {
  describe("bash", () => {
    it("returns a non-empty string for bash", () => {
      const script = generateCompletion("bash");
      expect(typeof script).toBe("string");
      expect(script.length).toBeGreaterThan(0);
    });

    it("contains the tool name 'github-code-search'", () => {
      expect(generateCompletion("bash")).toContain("github-code-search");
    });

    it("contains all subcommands (query, upgrade, completions)", () => {
      const script = generateCompletion("bash");
      expect(script).toContain("query");
      expect(script).toContain("upgrade");
      expect(script).toContain("completions");
    });

    it("contains common options", () => {
      const script = generateCompletion("bash");
      expect(script).toContain("--org");
      expect(script).toContain("--format");
      expect(script).toContain("--output-type");
      expect(script).toContain("--no-interactive");
    });

    it("contains format values (markdown, json)", () => {
      const script = generateCompletion("bash");
      expect(script).toContain("markdown");
      expect(script).toContain("json");
    });

    it("contains output-type values", () => {
      const script = generateCompletion("bash");
      expect(script).toContain("repo-and-matches");
      expect(script).toContain("repo-only");
    });

    it("contains a 'complete' directive (bash-style)", () => {
      const script = generateCompletion("bash");
      expect(script).toContain("complete ");
    });
  });

  describe("zsh", () => {
    it("returns a non-empty string for zsh", () => {
      const script = generateCompletion("zsh");
      expect(typeof script).toBe("string");
      expect(script.length).toBeGreaterThan(0);
    });

    it("contains the tool name 'github-code-search'", () => {
      expect(generateCompletion("zsh")).toContain("github-code-search");
    });

    it("contains all subcommands (query, upgrade, completions)", () => {
      const script = generateCompletion("zsh");
      expect(script).toContain("query");
      expect(script).toContain("upgrade");
      expect(script).toContain("completions");
    });

    it("contains common options", () => {
      const script = generateCompletion("zsh");
      expect(script).toContain("--org");
      expect(script).toContain("--format");
      expect(script).toContain("--output-type");
    });

    it("contains a 'compdef' directive (zsh-style)", () => {
      const script = generateCompletion("zsh");
      expect(script).toContain("compdef ");
    });
  });

  describe("fish", () => {
    it("returns a non-empty string for fish", () => {
      const script = generateCompletion("fish");
      expect(typeof script).toBe("string");
      expect(script.length).toBeGreaterThan(0);
    });

    it("contains the tool name 'github-code-search'", () => {
      expect(generateCompletion("fish")).toContain("github-code-search");
    });

    it("contains all subcommands (query, upgrade, completions)", () => {
      const script = generateCompletion("fish");
      expect(script).toContain("query");
      expect(script).toContain("upgrade");
      expect(script).toContain("completions");
    });

    it("contains common options (long flags)", () => {
      const script = generateCompletion("fish");
      expect(script).toContain("org");
      expect(script).toContain("format");
      expect(script).toContain("output-type");
    });

    it("uses fish 'complete -c' syntax", () => {
      const script = generateCompletion("fish");
      expect(script).toContain("complete -c github-code-search");
    });
  });

  describe("error cases", () => {
    it("throws for an unknown shell", () => {
      expect(() => generateCompletion("powershell")).toThrow();
    });

    it("throws for an empty string", () => {
      expect(() => generateCompletion("")).toThrow();
    });

    it("error message mentions the unsupported shell name", () => {
      expect(() => generateCompletion("ksh")).toThrow(/ksh/);
    });
  });
});

// ─── detectShell ──────────────────────────────────────────────────────────────

describe("detectShell", () => {
  it("detects fish when $SHELL ends with /fish", () => {
    const original = process.env.SHELL;
    process.env.SHELL = "/usr/local/bin/fish";
    expect(detectShell()).toBe("fish");
    process.env.SHELL = original;
  });

  it("detects zsh when $SHELL ends with /zsh", () => {
    const original = process.env.SHELL;
    process.env.SHELL = "/bin/zsh";
    expect(detectShell()).toBe("zsh");
    process.env.SHELL = original;
  });

  it("detects bash when $SHELL ends with /bash", () => {
    const original = process.env.SHELL;
    process.env.SHELL = "/bin/bash";
    expect(detectShell()).toBe("bash");
    process.env.SHELL = original;
  });

  it("returns null when $SHELL is unset", () => {
    const original = process.env.SHELL;
    delete process.env.SHELL;
    expect(detectShell()).toBeNull();
    process.env.SHELL = original;
  });

  it("returns null for an unrecognised shell path", () => {
    const original = process.env.SHELL;
    process.env.SHELL = "/bin/dash";
    expect(detectShell()).toBeNull();
    process.env.SHELL = original;
  });
});

// ─── getCompletionFilePath ────────────────────────────────────────────────────

describe("getCompletionFilePath", () => {
  const HOME = "/home/testuser";

  // Save and clear XDG env vars so tests are not affected by the CI environment
  // (GitHub Actions runners have XDG_CONFIG_HOME/XDG_DATA_HOME already set).
  let savedXdgConfigHome: string | undefined;
  let savedXdgDataHome: string | undefined;
  let savedZdotdir: string | undefined;

  beforeEach(() => {
    savedXdgConfigHome = process.env.XDG_CONFIG_HOME;
    savedXdgDataHome = process.env.XDG_DATA_HOME;
    savedZdotdir = process.env.ZDOTDIR;
    delete process.env.XDG_CONFIG_HOME;
    delete process.env.XDG_DATA_HOME;
    delete process.env.ZDOTDIR;
  });

  afterEach(() => {
    if (savedXdgConfigHome !== undefined) process.env.XDG_CONFIG_HOME = savedXdgConfigHome;
    if (savedXdgDataHome !== undefined) process.env.XDG_DATA_HOME = savedXdgDataHome;
    if (savedZdotdir !== undefined) process.env.ZDOTDIR = savedZdotdir;
  });

  describe("fish", () => {
    it("uses ~/.config/fish/completions/ by default", () => {
      expect(getCompletionFilePath("fish", { homeDir: HOME })).toBe(
        "/home/testuser/.config/fish/completions/github-code-search.fish",
      );
    });

    it("respects XDG_CONFIG_HOME when set", () => {
      expect(
        getCompletionFilePath("fish", { homeDir: HOME, xdgConfigHome: "/custom/config" }),
      ).toBe("/custom/config/fish/completions/github-code-search.fish");
    });

    it("returns a .fish extension", () => {
      const p = getCompletionFilePath("fish", { homeDir: HOME });
      expect(p).toMatch(/\.fish$/);
    });
  });

  describe("zsh", () => {
    it("uses ~/.zfunc/_github-code-search by default", () => {
      expect(getCompletionFilePath("zsh", { homeDir: HOME })).toBe(
        "/home/testuser/.zfunc/_github-code-search",
      );
    });

    it("respects ZDOTDIR when set", () => {
      expect(getCompletionFilePath("zsh", { homeDir: HOME, zdotdir: "/custom/zdot" })).toBe(
        "/custom/zdot/.zfunc/_github-code-search",
      );
    });

    it("starts the filename with an underscore (zsh convention)", () => {
      const p = getCompletionFilePath("zsh", { homeDir: HOME });
      expect(p.split("/").pop()).toBe("_github-code-search");
    });
  });

  describe("bash", () => {
    it("uses ~/.local/share/bash-completion/completions/ by default", () => {
      expect(getCompletionFilePath("bash", { homeDir: HOME })).toBe(
        "/home/testuser/.local/share/bash-completion/completions/github-code-search",
      );
    });

    it("respects XDG_DATA_HOME when set", () => {
      expect(getCompletionFilePath("bash", { homeDir: HOME, xdgDataHome: "/custom/data" })).toBe(
        "/custom/data/bash-completion/completions/github-code-search",
      );
    });

    it("has no file extension", () => {
      const p = getCompletionFilePath("bash", { homeDir: HOME });
      expect(p.split("/").pop()).toBe("github-code-search");
    });
  });
});
