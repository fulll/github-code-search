/**
 * Shell completion script generators for github-code-search.
 *
 * Pure functions — no I/O side effects.
 */
import { homedir } from "node:os";

// ─── Shared option/subcommand metadata ───────────────────────────────────────

const SUBCOMMANDS = [
  { name: "query", description: "Search GitHub code (default command)" },
  { name: "upgrade", description: "Check for a new release and auto-upgrade the binary" },
  { name: "completions", description: "Print shell completion script to stdout" },
] as const;

const OPTIONS = [
  { flag: "org", description: "GitHub organization to search in", takesArg: true, values: [] },
  {
    flag: "format",
    description: "Output format",
    takesArg: true,
    values: ["markdown", "json"],
  },
  {
    flag: "output-type",
    description: "Output type",
    takesArg: true,
    values: ["repo-and-matches", "repo-only"],
  },
  {
    flag: "exclude-repositories",
    description: "Comma-separated repositories to exclude",
    takesArg: true,
    values: [],
  },
  {
    flag: "exclude-extracts",
    description: "Comma-separated extract refs to exclude",
    takesArg: true,
    values: [],
  },
  {
    flag: "group-by-team-prefix",
    description: "Comma-separated team-name prefixes for grouping",
    takesArg: true,
    values: [],
  },
  {
    flag: "no-interactive",
    description: "Disable interactive mode",
    takesArg: false,
    values: [],
  },
  {
    flag: "include-archived",
    description: "Include archived repositories",
    takesArg: false,
    values: [],
  },
  {
    flag: "no-cache",
    description: "Bypass the 24 h team-list cache",
    takesArg: false,
    values: [],
  },
  {
    flag: "regex-hint",
    description: "Override the API search term for regex queries",
    takesArg: true,
    values: [],
  },
] as const;

// ─── Bash completion script ───────────────────────────────────────────────────

function generateBash(): string {
  const subcommandList = SUBCOMMANDS.map((s) => s.name).join(" ");
  const optionList = OPTIONS.map((o) => `--${o.flag}`).join(" ");

  const valueCases = OPTIONS.filter((o) => o.values.length > 0)
    .map(
      (o) =>
        `    --${o.flag})\n      COMPREPLY=($(compgen -W "${o.values.join(" ")}" -- "$cur"))\n      return 0;;`,
    )
    .join("\n");

  // Use \${ to emit literal bash ${...} expansions without TypeScript evaluating them.
  return `# bash completion for github-code-search
# Install: eval "$(github-code-search completions --shell bash)"

_github_code_search_completions() {
  local cur prev words cword
  # shellcheck disable=SC2034
  _init_completion 2>/dev/null || {
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
  }

  # Value completions for specific options
  case "$prev" in
${valueCases}
  esac

  # If on the first positional word, complete subcommands
  if [[ "$COMP_CWORD" -eq 1 ]] && [[ "$cur" != -* ]]; then
    COMPREPLY=($(compgen -W "${subcommandList}" -- "$cur"))
    return 0
  fi

  # Otherwise complete option flags
  COMPREPLY=($(compgen -W "${optionList}" -- "$cur"))
}

complete -F _github_code_search_completions github-code-search
`;
}

// ─── Zsh completion script ────────────────────────────────────────────────────

function generateZsh(): string {
  const subcommandArgs = SUBCOMMANDS.map(
    (s) => `    '(${s.name})${s.name}[${s.description}]'`,
  ).join("\n");

  const optionArgs = OPTIONS.map((o) => {
    if (o.values.length > 0) {
      return `    '--${o.flag}[${o.description}]:${o.flag}:(${o.values.join(" ")})'`;
    }
    if (o.takesArg) {
      return `    '--${o.flag}[${o.description}]:${o.flag}:'`;
    }
    return `    '--${o.flag}[${o.description}]'`;
  }).join("\n");

  return `#compdef github-code-search
# zsh completion for github-code-search
# Install: eval "$(github-code-search completions --shell zsh)"

_github_code_search() {
  _arguments \\
    '1: :->subcommand' \\
${optionArgs}

  case "$state" in
    subcommand)
      local subcommands
      subcommands=(
${subcommandArgs}
      )
      _describe 'subcommand' subcommands
      ;;
  esac
}

compdef _github_code_search github-code-search
`;
}

// ─── Fish completion script ───────────────────────────────────────────────────

function generateFish(): string {
  const subcommandLines = SUBCOMMANDS.map(
    (s) =>
      `complete -c github-code-search -n '__fish_use_subcommand' -a '${s.name}' -d '${s.description}'`,
  ).join("\n");

  const optionLines = OPTIONS.map((o) => {
    const base = `complete -c github-code-search -l '${o.flag}' -d '${o.description}'`;
    if (o.values.length > 0) {
      return `${base} -a '${o.values.join(" ")}' -r`;
    }
    if (o.takesArg) {
      return `${base} -r`;
    }
    return base;
  }).join("\n");

  return `# fish completion for github-code-search
# Install: github-code-search completions --shell fish | source

# Subcommands
${subcommandLines}

# Options
${optionLines}
`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Supported shell names. */
export type Shell = "bash" | "zsh" | "fish";

/**
 * Returns a shell completion script for the given shell name.
 * Throws if the shell is unsupported.
 */
export function generateCompletion(shell: string): string {
  switch (shell) {
    case "bash":
      return generateBash();
    case "zsh":
      return generateZsh();
    case "fish":
      return generateFish();
    default:
      throw new Error(`Unsupported shell: ${shell}. Supported shells are: bash, zsh, fish.`);
  }
}

/**
 * Detects the current shell from the $SHELL environment variable.
 * Returns null if $SHELL is unset or the shell is not supported.
 */
export function detectShell(): Shell | null {
  const shellPath = process.env.SHELL;
  if (!shellPath) return null;
  const name = shellPath.split("/").pop()?.toLowerCase();
  if (name === "bash" || name === "zsh" || name === "fish") return name;
  return null;
}

// ─── Completion file paths ────────────────────────────────────────────────────

/**
 * Returns the canonical path where the completion file should be written
 * for the given shell. Respects XDG and ZDOTDIR environment variables.
 *
 * All parameters except `shell` are injectable for testability.
 */
export function getCompletionFilePath(
  shell: Shell,
  {
    homeDir = homedir(),
    xdgConfigHome = process.env.XDG_CONFIG_HOME,
    xdgDataHome = process.env.XDG_DATA_HOME,
    zdotdir = process.env.ZDOTDIR,
  }: {
    homeDir?: string;
    xdgConfigHome?: string;
    xdgDataHome?: string;
    zdotdir?: string;
  } = {},
): string {
  switch (shell) {
    case "fish": {
      const configHome = xdgConfigHome ?? `${homeDir}/.config`;
      return `${configHome}/fish/completions/github-code-search.fish`;
    }
    case "zsh": {
      const zfuncDir = zdotdir ?? homeDir;
      return `${zfuncDir}/.zfunc/_github-code-search`;
    }
    case "bash": {
      const dataHome = xdgDataHome ?? `${homeDir}/.local/share`;
      return `${dataHome}/bash-completion/completions/github-code-search`;
    }
  }
}
