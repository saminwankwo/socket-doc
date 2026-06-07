# Changelog

All notable changes to this project will be documented in this file.

## [0.1.3] - 2026-06-04

### Added
- **Swagger-like Documentation URL**: Ability to mount the documentation UI directly on your server.
  - Added `serveFastifyDocs` to `@socketdocs/fastify`.
  - Added `handleWsDocs` to `@socketdocs/ws`.
- **Middleware & Auth Documentation**: New `security` section in `createContract` to document connection requirements (headers, query params, etc.).
- **Better Error Schema Mapping**: Added `.errors()` method to event builders to document specific error responses for events.
- **UI Improvements**: New security section and error display in the documentation explorer.
- **CLI Auto-Port Detection**: The `serve-docs` command now automatically tries the next available port if 4000 is taken.

### Fixed
- Fixed several linting errors across the monorepo related to unused variables and require statements.
- Synchronized `package-lock.json` with `package.json` to fix `npm ci` failures in CI/CD pipelines.
- Updated GitHub Actions workflow to correctly trigger builds on PRs to `main` and publish on merges to `master`.

## [0.1.2] - 2026-05-18

### Added
- Initial monorepo structure with support for Socket.IO, Fastify, and NestJS.
- CLI for spec generation and SDK creation.
- Core validation logic using Zod.
