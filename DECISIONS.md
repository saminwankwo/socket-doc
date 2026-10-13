# DECISIONS

Judgment calls made during the `1.0.0-alpha.0` redesign.

## Phase 1

- **Deleted `packages/cli`, `packages/server`, `packages/nestjs` in Phase 1.** They import old core APIs (`createContract`, `generateHtml`, `convertContractToSocketDocsSchema`) that Phase 2 removes. Rather than maintain shims, they are recreated fresh in Phases 4, 6, and 8. The old source is preserved in git history.
- **Deleted legacy root samples `contract.ts` and `socketdocs.json`.** Not referenced by any package; they belonged to the removed contract-first path.
- **vitest only.** Removed `jest`, `ts-jest`, `@types/jest`, and `jest.config.cjs` from core and root.
- **`examples/` workspace glob kept** with a `.gitkeep` placeholder; real examples arrive in Phase 7.
