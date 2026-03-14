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
One of our main goals is to support as many languages as possible. If you'd like to add a new language to the SDK generator:

1.  **Locate the Generator**: The SDK generation logic is located in [packages/cli/src/index.ts](packages/cli/src/index.ts).
2.  **Add your Language**:
    - Add a new `else if (options.lang === "your-lang")` block in the `generate-sdk` command.
    - Implement the logic to iterate through `spec.namespaces` and `ns.events`.
    - Generate the appropriate source code for that language.
3.  **Submit a PR**: Include a sample of the generated code in your PR description.

### 4. Development Setup
- Fork the repository.
- Run `npm install` to install dependencies.
- Use `npm run build` to compile all packages.
- Run `npm test` to ensure everything is working correctly.

### 5. Code Style
- We use ESLint and Prettier for code consistency.
- Please ensure your code passes the linting check before submitting a PR.

## License
By contributing to SocketDocs, you agree that your contributions will be licensed under the MIT License.
