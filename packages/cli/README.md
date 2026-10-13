# @socketdocs/cli

A minimal CLI for **SocketDocs** (Swagger-style documentation for Socket.IO): lint a spec and export it to AsyncAPI. The spec is either fetched from a live server's `/spec.json` endpoint or read from a local file — the CLI never loads TypeScript contracts.

## Install

```bash
npm install -g @socketdocs/cli
```

Requires Node.js ≥ 18 (global `fetch`). Depends only on `@socketdocs/core`.

## Commands

### `socketdocs lint`

Runs `lintSpec` on a SocketDocs spec and prints the issues.

```bash
socketdocs lint --url http://localhost:3000/socket-docs/spec.json
socketdocs lint --file ./spec.json
```

Exit codes: `0` no errors (warnings are allowed), `1` errors or the spec could not be loaded, `2` usage error.

### `socketdocs export-asyncapi`

Converts the spec to an AsyncAPI 3.0 document (`toAsyncApi` in `@socketdocs/core`).

```bash
socketdocs export-asyncapi --url http://localhost:3000/socket-docs/spec.json -o asyncapi.json
socketdocs export-asyncapi --file ./spec.json          # printed to stdout
```

## Options

| Option | Description |
|---|---|
| `--url <url>` | Load the spec from a live server (e.g. `.../socket-docs/spec.json`). |
| `--file <path>` | Load the spec from a local JSON file. |
| `-o`, `--output <path>` | Write the AsyncAPI document to a file instead of stdout. |
| `-h`, `--help` | Show usage. |
| `-V`, `--version` | Print the version. |

`--url` and `--file` are mutually exclusive; one of them is required for both commands.

## Programmatic use

```ts
import { runCli, loadSpec, parseArgs } from "@socketdocs/cli";

const code = await runCli(["lint", "--file", "spec.json"], {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
});
```

`runCli` never calls `process.exit` — it resolves with the exit code, so it is safe to embed in tests or other tooling.

## License

MIT © Nwankwo Samuel
