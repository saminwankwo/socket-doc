# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-06-11

### Added
- **Mock Server**: Complete mock server implementation that generates realistic mock data based on schemas using `@faker-js/faker`
- **Enhanced Validation**: Comprehensive contract validation with deep checking of namespaces, events, roles, and more
- **AsyncAPI 3.0**: Upgraded AsyncAPI conversion from 2.x to 3.0 with proper operations and server definitions
- **Security Schemes**: Added support for converting security schemes to AsyncAPI format
- **Improved Linting**: Added many new linting rules including duplicate event checking, duplicate error codes, auth validation, examples validation, and more
- **Comprehensive JSDoc**: Added complete documentation to all public APIs for better developer experience
- **More Test Coverage**: Added extensive test coverage for edge cases including bidirectional events, request-response, errors, security, examples, and multiple namespaces

### Improved
- **Consistent Error Handling**: Changed Socket.IO adapter from using `parse()` to `safeParse()` for consistent error handling and notifications
- **Type Safety**: Added proper TypeScript interfaces and types for Socket.IO adapter handlers
- **Clean Imports**: Fixed Ajv imports across packages for cleaner and more maintainable code

### Fixed
- **Mock Server Placeholder**: Replaced the mock server placeholder with a full, working implementation
- **Validate Command**: Enhanced `validate-contract` from a simple check to comprehensive deep validation
- **AsyncAPI Conversion**: Improved AsyncAPI spec generation with proper channels, operations, and examples

## [0.2.0] - 2026-06-08

### Added
- **Plugin Lifecycle Hooks**: Added `onResponse` and `onError` hooks to the plugin system for enhanced monitoring and logging
- **Improved CLI Loading**: Integrated `jiti` for robust runtime loading of TypeScript and ESM contracts without pre-compilation

### Changed
- **Build System Overhaul**: Migrated to **TypeScript Project References** for reliable topological builds across the monorepo
- **Unified Validation**: Refactored internal validation logic to provide consistent behavior for both request (payload) and response validation using Zod or JSON Schema
- **Monorepo Orchestration**: Added root `tsconfig.json` and optimized `npm run build` to handle workspace dependencies correctly
- **Major Dependency Updates**: Updated all core dependencies to their latest versions for better performance and security
  - Updated `zod` to `^4.4.3`
  - Updated `typescript` to `^6.0.3`
  - Updated `jest` to `^30.4.2`
  - Updated `eslint` to `^10.4.1`
  - Updated `nestjs` to `^11.1.24`
  - Updated `fastify` to `^5.8.5`
  - Updated `react` to `^19.2.7` and `vite` to `^8.0.16` in docs-server
- **Internal Synchronization**: All packages in the monorepo have been bumped to `0.2.0`

## [0.1.3] - 2026-06-04

### Added
- **Swagger-like Documentation URL**: Ability to mount the documentation UI directly on your server
  - Added `serveFastifyDocs` to `@socketdocs/fastify`
  - Added `handleWsDocs` to `@socketdocs/ws`
- **Middleware & Auth Documentation**: New `security` section in `createContract` to document connection requirements (headers, query params, etc.)
- **Better Error Schema Mapping**: Added `.errors()` method to event builders to document specific error responses for events
- **UI Improvements**: New security section and error display in the documentation explorer
- **CLI Auto-Port Detection**: The `serve-docs` command now automatically tries the next available port if 4000 is taken

### Fixed
- Fixed several linting errors across the monorepo related to unused variables and require statements
- Synchronized `package-lock.json` with `package.json` to fix `npm ci` failures in CI/CD pipelines
- Updated GitHub Actions workflow to correctly trigger builds on PRs to `main` and publish on merges to `master`

## [0.1.2] - 2026-05-18

### Added
- Initial monorepo structure with support for Socket.IO, Fastify, and NestJS
- CLI for spec generation and SDK creation
- Core validation logic using Zod
