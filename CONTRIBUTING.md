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

### 3. Adding New SDK Languages (High Priority!)
One of our main goals is to support as many languages as possible. We use a **Strategy Pattern** for SDK generation.

1.  **Locate the Generators**: SDK generation logic is located in [packages/cli/src/generators/](packages/cli/src/generators/).
2.  **Implement the Generator**:
    - Create a new class that implements the `SdkGenerator` interface (found in `index.ts` of the generators folder).
    - Provide implementations for `generate(spec: any): string` and `getFileExtension(): string`.
3.  **Register your Language**:
    - Add an instance of your new generator to the `generators` record in [packages/cli/src/index.ts](packages/cli/src/index.ts).
4.  **Submit a PR**: Include a sample of the generated code in your PR description.

### 4. Adding New Server Adapters
If you'd like to support a new WebSocket framework (e.g., Koa, Hapi, or a custom internal framework):
1.  **Create a Package**: Add a new folder in `packages/` (e.g., `packages/koa`).
2.  **Implement the Binding**: Create a `bind[Name]Adapter` function that:
    - Takes a `Contract` and `handlers` as input.
    - Implements the validation and auth logic using the `createValidator` helper from `@socketdocs/core`.
3.  **Add Tests**: Ensure your adapter has unit tests in a `__tests__` folder.

### 5. Improving the Docs UI
The documentation UI is built with React and Tailwind CSS in [packages/docs-server/](packages/docs-server/).
- To develop locally: `npm run dev -w @socketdocs/docs-server`.
- We welcome improvements to the **Playground**, **Schema Visualization**, and **Theming**.

### 6. Development Setup
SocketDocs is a **Lerna-style monorepo** managed with npm workspaces.

- Fork and clone the repository.
- Run `npm install` to install all dependencies at the root.
- Use `npm run build` to compile all packages (this is required before running tests or the CLI).
- Run `npm test` to run the test suite across all packages.

### 7. Code Style
- We use ESLint and Prettier for code consistency.
- Please ensure your code passes the linting check before submitting a PR.

## License
By contributing to SocketDocs, you agree that your contributions will be licensed under the MIT License.
