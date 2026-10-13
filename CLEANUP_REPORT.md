# SocketDocs Cleanup Report

Branch: `chore/cleanup` (created from `redesign/swagger-for-sockets`). One commit per phase; nothing committed to `main`.

| Commit    | Phase                                                      |
| --------- | ---------------------------------------------------------- |
| `5b2634c` | Phase 0: pending user edits committed to clean the tree    |
| `da54731` | Phase 1: `chore: remove leftovers from redesign`           |
| `6ab3094` | Phase 2: `chore: remove dead code and unused dependencies` |
| `9b1f9e8` | Phase 3: `chore: align tsconfig and manifests`             |
| `7081ac3` | Phase 3: `style: apply prettier and eslint fixes`          |
| `7361ef5` | Phase 4: `chore: packaging, docs and CI cleanup`           |

---

## 1. Before / after

| Metric            | Before (baseline) | After                                                      |
| ----------------- | ----------------- | ---------------------------------------------------------- |
| Tracked files     | 84                | 92 (+8: LICENSE ×4, prettier/editor configs, pack-test.sh) |
| TS/TSX files      | 41                | 41                                                         |
| TS/TSX lines      | 4,697             | 5,236 (prettier reflow, no new code)                       |
| All tracked lines | 12,390            | 15,705 (prettier reflow + new files)                       |

Dependency count per package (dependencies / devDependencies / peerDependencies):

| Package  | Before     | After      | Why                                                                              |
| -------- | ---------- | ---------- | -------------------------------------------------------------------------------- |
| core     | 1 / 1 / 0  | 1 / 1 / 0  | unchanged                                                                        |
| ui       | 6 / 9 / 0  | 4 / 9 / 0  | −clsx −tailwind-merge; −typescript (hoisted) +vitest (was unlisted)              |
| express  | 1 / 5 / 2  | 1 / 6 / 3  | +zod (dev + optional peer; it was imported but unlisted)                         |
| nestjs   | 2 / 12 / 6 | 2 / 12 / 6 | unchanged                                                                        |
| cli      | 1 / 1 / 0  | 1 / 1 / 0  | unchanged                                                                        |
| root dev | 10         | 11         | +knip +madge +socket.io-client (check-examples); −lightningcss −reflect-metadata |

`npm pack --dry-run` per published package (Phase 0 → now):

| Package | Size           | Files   | Unpacked         | Delta    |
| ------- | -------------- | ------- | ---------------- | -------- |
| core    | 6.4 → 7.3 kB   | 14 → 15 | 25.4 → 26.9 kB   | +LICENSE |
| express | 85.8 → 86.8 kB | 11 → 12 | 297.2 → 300.0 kB | +LICENSE |
| nestjs  | 5.9 → 6.7 kB   | 6 → 7   | 18.8 → 20.4 kB   | +LICENSE |
| cli     | 3.9 → 4.7 kB   | 6 → 7   | 12.5 → 14.2 kB   | +LICENSE |

Every tarball contains only `dist/` (+ `ui-dist/` for express), `package.json`, `README.md`, `LICENSE` — no `src/`, tests, tsconfig or `.map` files (asserted by `scripts/pack-test.sh`).

---

## 2. Removed

**Already gone at baseline** (verified with grep/knip, nothing to delete): packages `ws`, `fastify`, `socket-io`, `server`; CLI SDK generators, mock server, `validate-contract`, faker/ts-node deps; core's contract model (`createContract`, `SocketDocsSchema`, `PluginManager`, `generateHtml`, `decorators.ts`, `createValidator`); root demo files (`contract.ts`, `wsdoc.json`, …); committed build artifacts; Jest config/deps. The redesign had already cut them; only docs referenced them.

**Removed on this branch:**

- **ESLint**: `globals.jest` (tests import `vitest` explicitly).
- **Dependencies**: `clsx`, `tailwind-merge` (ui, zero imports); `lightningcss`, `reflect-metadata` (root, zero uses); `socket.io-client` (express-chat example, no code usage); `typescript` (ui — root `tsc -b` drives it, ui has no `tsc` script).
- **Exports**: duplicate `App` named export (App.tsx; `main.tsx` uses default), duplicate `Footer` default export (App.tsx imports the named one).
- **Docs**: CONTRIBUTING sections for removed features (SDK generators, old `bindAdapter`/`createValidator` architecture, mock server + `wsdoc.schema.json`, `docs-server` package name, "Lerna-style").
- **.gitignore**: duplicate `old`, ineffective `package-lock.json*` (the lockfile is tracked and required by CI's `npm ci`), normalized `node_modules*`.
- **TODO/FIXME/HACK markers**: none existed anywhere in code.

---

## 3. Changed

- **tsconfig**: removed `baseUrl` + `paths` mapping `@socketdocs/core` to `src` (Rule 4: cross-package resolution now goes only through project references + `exports`); removed duplicated `composite` / `experimentalDecorators` / `emitDecoratorMetadata`; `packages/ui/tsconfig.json` and `tsconfig.node.json` now extend `tsconfig.base.json` (UI overrides `moduleResolution: bundler`, `noEmit`, DOM lib, `types: []`). Verified `tsc -b` still type-checks the UI.
- **Manifests** (all published packages): added `homepage`, `bugs`, `engines` (Node ≥18), `sideEffects` (`false` for pure packages; explicit file list for nestjs, which does `import 'reflect-metadata'` for effect); `repository.url` aligned to the real remote `github.com/saminwankwo/socket-doc` (matching the owner's own concurrent edits, not the `socketdocs` name in the prompt); `description` added to ui.
- **Scripts**: `lint` (`eslint .`) and `clean` added to every package; root `clean` also removes the UI's tsc artifacts (`vite.config.js/.d.ts`, `tsconfig.node.tsbuildinfo`); `format` glob extended to `ts,tsx,js,mjs,cjs,json,md` (it silently missed `.tsx` before); added `check:circular` (madge). No `|| true` anywhere.
- **Lint/format**: created the previously missing root `.prettierrc` (`singleQuote`) + `.prettierignore`; ran `prettier --write` and `eslint --fix` as their own commit.
- **CI** (`.github/workflows/main.yml`): added `npm run check:examples` and `bash scripts/pack-test.sh` to the test job (pack test previously did not exist in any branch); no self-hosted runner labels exist.
- **Docs**: README — three non-existent CLI commands fixed (`export`, `asyncapi`, positional file → `curl`, `lint --file`, `export-asyncapi --file`), invalid `type: 'bearer'` security example → `apiKey`, false "NestJS in progress" claims and broken `#roadmap` link removed, `cd socketdocs` → `cd socket-doc`, packages table corrected; CONTRIBUTING documents the pack test; MIT `LICENSE` added to the 4 published packages.
- **New tooling**: `scripts/pack-test.sh` (build → pack → content assertions → install tarballs into a scratch consumer → import/registry smoke test → CLI `--version`), knip + madge as root devDependencies (madge pinned to v5 — see below).
- **Lockfile regenerated** (follow-up after the first CI run on Linux failed): the committed `package-lock.json` contained only the host-platform entries for the optional native binaries (`@rollup/rollup-darwin-x64`, `@esbuild/darwin-x64`), so `npm ci` on the Linux runner silently installed a tree without `@rollup/rollup-linux-x64-gnu` and `vite build` crashed — the classic npm optional-dependencies bug (npm/cli#4828). Regenerated with `rm -rf node_modules package-lock.json && npm install`; the lock now records all 25 rollup / 23 esbuild platform variants with `resolved`/`integrity`. Side effect: 59 transitive dependencies moved within their declared semver ranges (notably rollup 4.62→4.64.6, eslint 10.5→10.12, typescript-eslint 8.61→8.71, express 4.22.2→4.22.3, prettier 3.8→3.9), and 7 files were reformatted for prettier 3.9 style. No declared dependency ranges changed.

---

## 4. Needs a human decision

1. **`CLEANUP_PROMPT.md` references `REDESIGN_REPORT.md`, which never existed** in any branch. The closest artifact is `SOCKETDOCS_ARCHITECTURE_REPORT.md`.
2. **`SOCKETDOCS_ARCHITECTURE_REPORT.md` and `SOCKETDOCS_REDESIGN_PROMPT.md` are tracked but describe the pre-redesign architecture** (`@socketdocs/server`, `docs-server`, `Contract`, `bindSocketioAdapter` — all deleted). Left in place per "never delete on a hunch"; recommend deleting or moving them out of the repo.
3. **madge is pinned to v5**: madge 6/7/8 declare `typescript` peer ranges capped at v5, which conflicts with the repo's TypeScript 6 and would make plain `npm install` fail with ERESOLVE. v5 has no TS peer and works. Alternative: drop madge (and/or knip) from devDependencies — the prompt says remove them again if the owner doesn't want them kept.
4. **Repository naming**: the prompt asked for `github.com/saminwankwo/socketdocs`; the actual remote is `github.com/saminwankwo/socket-doc`. Everything (manifests, README) now uses `socket-doc`.
5. **`vite.config.js` precedence quirk (pre-existing)**: `tsc -b` compiles `packages/ui/vite.config.ts` next to itself (`.gitignore` documents this), and Vite resolves `vite.config.js` _before_ `.ts`, so after a build the dev server loads the compiled copy until the next build. Left alone (changing it would alter behavior).
6. **Examples have no `lint`/`clean` scripts**: "same script names in every package" was applied to the workspace packages, not the two private example apps (`eslint .` there risks a zero-match error).
7. **`nestjs` `sideEffects` list** (`dist/index.js`, `dist/decorators.js`): revisit if subpath exports are ever added.
8. **Analysis tools kept**: `knip` and `madge` remain root devDependencies with working `npm install`/`npm ci` (madge@5). Remove if unwanted.

---

## 5. Remaining TODOs / known issues

- **No `TODO` / `FIXME` / `HACK` markers in the codebase.**
- `packages/ui/src/App.tsx` is **506 lines** (over the ~300 guideline). Not split: the drawer/spec/connection state are entangled, and splitting risks UI behavior (Rule 5).
- Hard-coded `localhost` in the UI, kept deliberately (functional/UX, not leftovers):
  - `packages/ui/src/App.tsx:26` — non-browser fallback for `window.location.origin`
  - `packages/ui/src/App.tsx:80` — sentinel for "replace default URL with `spec.servers`"
  - `packages/ui/src/components/ConnectionBar.tsx:49` — input placeholder
- Product limits are documented, not bugs: Socket.IO v4 only; Express sniffing starts at the first client connection; Nest `server_to_client` sniffing requires `@WebSocketServer()`; NestJS requires the Express adapter; core declares `zod` as a runtime dependency despite type-only imports (deliberate, recorded in `DECISIONS.md`).

---

## 6. Verification (after cleanup)

| Check                                | Result                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `npm ci`                             | OK (no `--legacy-peer-deps` needed)                                                                      |
| `npm run build`                      | OK (tsc -b + vite + ui copy)                                                                             |
| `npm test`                           | 54/54 (core 22, cli 11, ui 10, express 6, nestjs 5)                                                      |
| `npm run lint`                       | OK (0 errors, 0 warnings)                                                                                |
| `prettier --check`                   | "All matched files use Prettier code style"                                                              |
| `./scripts/pack-test.sh`             | PASSED (contents, scratch install, imports, registry round-trip, CLI `--version`)                        |
| `npm run check:examples`             | 16/16                                                                                                    |
| `npx knip`                           | clean                                                                                                    |
| `npm run check:circular`             | no circular dependencies (madge skips non-TS imports such as `./index.css`, which it counts as warnings) |
| `npm run test:e2e -w @socketdocs/ui` | 12/12 (from the responsive pass; unchanged)                                                              |

CI now runs: `npm ci` → clean → build → test → lint → check:examples → pack test.
