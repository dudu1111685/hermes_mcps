# Contributing to WAHA MCP

Thank you for your interest in contributing to WAHA MCP! 🎉

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/dudu1111685/waha-mcp/issues) first
2. Use the bug report template
3. Include:
   - Steps to reproduce
   - Expected vs actual behavior
   - Your environment (Node.js version, OS, WAHA version)
   - Error messages/logs

### Suggesting Features

1. Open a [feature request](https://github.com/dudu1111685/waha-mcp/issues/new)
2. Describe the use case
3. Explain why it would be useful
4. Provide examples if possible

### Pull Requests

1. **Fork the repository**
   ```bash
   git clone https://github.com/dudu1111685/waha-mcp.git
   cd waha-mcp
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make your changes**
   - Follow the existing code style
   - Add tests if applicable
   - Update documentation

4. **Test your changes**
   ```bash
   npm run build
   npm test
   ```

5. **Commit with a clear message**
   ```bash
   git commit -m "feat: add amazing feature"
   ```

   Use conventional commits:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation
   - `refactor:` - Code refactoring
   - `test:` - Tests
   - `chore:` - Maintenance

6. **Push and create PR**
   ```bash
   git push origin feature/amazing-feature
   ```

## Development Setup

### Prerequisites
- Node.js 18+
- Running WAHA instance
- Git

### Setup
```bash
npm install
npm run build
npm run dev  # Watch mode
```

### Project Structure
```
waha-mcp/
├── src/
│   ├── index.ts          # Main entry
│   ├── tools/            # Tool definitions
│   └── utils/            # Helpers
├── docs/                 # Documentation
├── dist/                 # Build output
└── tests/               # Tests
```

## Code Style

- **TypeScript:** Use strict mode
- **Formatting:** Run `npm run format` before committing
- **Linting:** Run `npm run lint`
- **Comments:** Document complex logic

## Testing

- Write tests for new features
- Ensure all tests pass: `npm test`
- Aim for >80% code coverage

## Documentation

- Update README.md if adding features
- Add examples to `docs/18-examples.md`
- Document breaking changes

## Questions?

- 💬 [Start a discussion](https://github.com/dudu1111685/waha-mcp/discussions)
- 📧 Email: support@example.com

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for making WAHA MCP better!** ❤️
