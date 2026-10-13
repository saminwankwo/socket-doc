# Contributing to SocketDocs

Thank you for your interest in contributing to SocketDocs! We are building a modern ecosystem for WebSocket documentation and validation, and we'd love your help.

## How to Contribute

### 1. Reporting Bugs

If you find a bug, please open an issue with:

- A clear description of the problem.
- Steps to reproduce the issue.
- Your environment details (Node version, OS).

### 2. Feature Requests

We are open to new features! If you have an idea, please open an issue to discuss it first.

### 3. Adding New Server Adapters

SocketDocs is code-first: an adapter's job is to get a running server's events into the shared `EventRegistry` (in `@socketdocs/core`) so the spec and the docs UI can render them.

1.  **Create a Package**: Add a new folder in `packages/` (e.g., `packages/koa`).
2.  **Register Events**: Mirror `packages/express/src/instrument.ts` — call `registry.observe(...)` / `registry.declare(...)` as the framework reports events, and serve the UI and spec with `mountDocs` from `@socketdocs/express` (or an equivalent).
3.  **Add Tests**: Ensure your adapter has unit tests in a `__tests__` folder.

### 4. Improving the Docs UI

The documentation UI is built with React and Tailwind CSS in [packages/ui/](packages/ui/).

- To develop locally: `npm run dev -w @socketdocs/ui`.
- To run the packaging smoke test: `./scripts/pack-test.sh`.
- To run the responsive Playwright suite: `npm run test:e2e -w @socketdocs/ui` (it starts the `examples/express-chat` server automatically).
- We welcome improvements to the **Playground**, **Schema Visualization**, and **Theming**.

### 5. Pull Request Guidelines

To ensure a smooth review process, please follow these guidelines:

- **Branch Naming**: Use descriptive names like `feat/add-rust-sdk`, `fix/socketio-auth`, or `docs/update-readme`.
- **Atomic Commits**: Keep your commits focused and descriptive.
- **Tests**: Include unit tests for any new features or bug fixes.
- **Documentation**: Update the relevant README or this guide if your changes introduce new patterns.

### 6. Development Setup

SocketDocs is a monorepo managed with npm workspaces.

- Fork and clone the repository.
- Run `npm install` to install all dependencies at the root.
- Use `npm run build` to compile all packages (this is required before running tests or the CLI).
- Run `npm test` to run the test suite across all packages.

### 7. Code Style

- We use ESLint and Prettier for code consistency.
- Please ensure your code passes the linting check before submitting a PR.

## License

By contributing to SocketDocs, you agree that your contributions will be licensed under the MIT License.
