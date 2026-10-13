import { lintSpec, toAsyncApi, type LintIssue, type SocketDocsSpec } from "@socketdocs/core";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const EXIT_OK = 0;
export const EXIT_FAILURE = 1;
export const EXIT_USAGE = 2;

export interface CliIO {
  out: (line: string) => void;
  err: (line: string) => void;
}

const DEFAULT_IO: CliIO = {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
};

export interface SpecSource {
  /** Fetch the spec from a live server, e.g. http://localhost:3000/socket-docs/spec.json */
  url?: string;
  /** Read the spec from a local JSON file. */
  file?: string;
}

export function usage(): string {
  return [
    "socketdocs — Swagger-style documentation for Socket.IO",
    "",
    "Usage:",
    "  socketdocs lint           (--url <url> | --file <path>)",
    "  socketdocs export-asyncapi (--url <url> | --file <path>) [-o <file>]",
    "  socketdocs --version",
    "",
    "Commands:",
    "  lint             Lint a SocketDocs spec. Exits 1 if there are errors.",
    "  export-asyncapi  Convert the spec to an AsyncAPI 3.0 document.",
    "                   Written to --output when given, otherwise printed.",
    "",
    "Options:",
    "  --url <url>      Load the spec from a live server (e.g. .../spec.json).",
    "  --file <path>    Load the spec from a local JSON file.",
    "  -o, --output <path>  Write the AsyncAPI document to a file.",
    "  -h, --help       Show this help.",
    "  -V, --version    Print the version.",
  ].join("\n");
}

export async function readVersion(): Promise<string> {
  const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), "../package.json");
  try {
    const raw = await readFile(packageJsonPath, "utf8");
    return (JSON.parse(raw) as { version?: string }).version ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Loads and validates a SocketDocs spec. Returns `undefined` (after reporting
 * the problem) when the spec cannot be loaded or is not a spec at all.
 */
export async function loadSpec(source: SpecSource, io: CliIO = DEFAULT_IO): Promise<SocketDocsSpec | undefined> {
  let raw: string;

  if (source.url) {
    try {
      const response = await fetch(source.url);
      if (!response.ok) {
        io.err(`Failed to fetch ${source.url}: HTTP ${response.status} ${response.statusText}`);
        return undefined;
      }
      raw = await response.text();
    } catch (error) {
      io.err(`Failed to fetch ${source.url}: ${(error as Error).message}`);
      return undefined;
    }
  } else if (source.file) {
    try {
      raw = await readFile(source.file, "utf8");
    } catch (error) {
      io.err(`Failed to read ${source.file}: ${(error as Error).message}`);
      return undefined;
    }
  } else {
    io.err("No spec source given: use --url <url> or --file <path>.");
    io.err(usage());
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const origin = source.url ?? source.file;
    io.err(`${origin} is not valid JSON: ${(error as Error).message}`);
    return undefined;
  }

  const candidate = parsed as { info?: unknown; namespaces?: unknown } | null;
  if (
    !candidate ||
    typeof candidate !== "object" ||
    typeof candidate.info !== "object" ||
    candidate.info === null ||
    typeof candidate.namespaces !== "object" ||
    candidate.namespaces === null
  ) {
    const origin = source.url ?? source.file;
    io.err(`${origin} is not a SocketDocs spec: expected an object with "info" and "namespaces".`);
    return undefined;
  }

  return parsed as SocketDocsSpec;
}

export function formatIssue(issue: LintIssue): string {
  const marker = issue.type === "error" ? "✖ error  " : "⚠ warning";
  return `${marker} ${issue.message} (${issue.path})`;
}

export interface ParsedArgs {
  command: string | undefined;
  source: SpecSource;
  output?: string;
  help: boolean;
  version: boolean;
  error?: string;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { command: undefined, source: {}, help: false, version: false };
  const positional: string[] = [];

  const takeValue = (flag: string, index: number): string | undefined => {
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("-")) {
      parsed.error = `Missing value for ${flag}.`;
      return undefined;
    }
    return next;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--url") {
      const value = takeValue(arg, i);
      if (value) parsed.source.url = value;
      i++;
    } else if (arg.startsWith("--url=")) {
      parsed.source.url = arg.slice("--url=".length);
    } else if (arg === "--file") {
      const value = takeValue(arg, i);
      if (value) parsed.source.file = value;
      i++;
    } else if (arg.startsWith("--file=")) {
      parsed.source.file = arg.slice("--file=".length);
    } else if (arg === "-o" || arg === "--output") {
      const value = takeValue(arg, i);
      if (value) parsed.output = value;
      i++;
    } else if (arg.startsWith("--output=")) {
      parsed.output = arg.slice("--output=".length);
    } else if (arg === "-h" || arg === "--help") {
      parsed.help = true;
    } else if (arg === "-V" || arg === "--version") {
      parsed.version = true;
    } else if (arg.startsWith("-")) {
      parsed.error = `Unknown option: ${arg}`;
    } else {
      positional.push(arg);
    }
  }

  parsed.command = positional[0];
  if (positional.length > 1) {
    parsed.error = `Unexpected argument: ${positional[1]}`;
  }

  if (parsed.source.url && parsed.source.file) {
    parsed.error = "Use either --url or --file, not both.";
  }

  return parsed;
}

/**
 * Runs the CLI and returns the process exit code:
 * `0` success, `1` failure (lint errors, network/IO problems), `2` usage error.
 */
export async function runCli(argv: string[], io: CliIO = DEFAULT_IO): Promise<number> {
  const args = parseArgs(argv);

  if (args.version) {
    io.out(await readVersion());
    return EXIT_OK;
  }

  if (args.help) {
    io.out(usage());
    return EXIT_OK;
  }

  if (!args.command && argv.length === 0) {
    io.err(usage());
    return EXIT_USAGE;
  }

  if (args.error) {
    io.err(args.error);
    io.err(usage());
    return EXIT_USAGE;
  }

  switch (args.command) {
    case "lint": {
      const spec = await loadSpec(args.source, io);
      if (!spec) return EXIT_FAILURE;

      const issues = lintSpec(spec);
      for (const issue of issues) {
        io.out(formatIssue(issue));
      }

      const errors = issues.filter((issue) => issue.type === "error").length;
      const warnings = issues.length - errors;
      if (errors > 0) {
        io.err(`✖ ${errors} error(s), ${warnings} warning(s)`);
        return EXIT_FAILURE;
      }
      io.out(`✓ no errors (${warnings} warning(s))`);
      return EXIT_OK;
    }

    case "export-asyncapi": {
      const spec = await loadSpec(args.source, io);
      if (!spec) return EXIT_FAILURE;

      const document = toAsyncApi(spec);
      const json = `${JSON.stringify(document, null, 2)}\n`;

      if (args.output) {
        try {
          await writeFile(args.output, json, "utf8");
        } catch (error) {
          io.err(`Failed to write ${args.output}: ${(error as Error).message}`);
          return EXIT_FAILURE;
        }
        io.out(`AsyncAPI document written to ${args.output}`);
        return EXIT_OK;
      }

      io.out(json.trimEnd());
      return EXIT_OK;
    }

    default:
      io.err(`Unknown command: ${args.command}`);
      io.err(usage());
      return EXIT_USAGE;
  }
}
