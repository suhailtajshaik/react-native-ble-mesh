# Contributing to BLE Mesh

Thank you for your interest in contributing to BLE Mesh! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/react-native-ble-mesh.git
   cd react-native-ble-mesh
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run tests to ensure everything works:
   ```bash
   npm test
   ```

## Development Guidelines

### Code Style

- **Maximum 200 lines per file** - Split large files into focused modules
- Use **JSDoc comments** for all public APIs
- Follow existing code patterns and naming conventions
- Use strict mode (`'use strict';`) in all files

### File Organization

```
src/
├── core/         # Core mesh service
├── crypto/       # Cryptographic primitives (flat structure)
├── protocol/     # Wire protocol
├── mesh/         # Mesh networking (flat structure)
├── transport/    # Transport layer (flat structure)
├── storage/      # Data persistence
├── utils/        # Utility functions
├── errors/       # Error classes
├── hooks/        # React Native hooks
└── plugins/      # Optional features (audio, text)
```

### Writing Code

```javascript
'use strict';

/**
 * @fileoverview Brief description of the file
 * @module module/name
 */

const SomeDependency = require('./SomeDependency');

/**
 * Description of the class/function
 * @class ClassName
 * @example
 * const instance = new ClassName(options);
 */
class ClassName {
  /**
   * Creates a new instance
   * @param {Object} options - Configuration options
   * @param {string} options.name - The name
   */
  constructor(options = {}) {
    // Implementation
  }
}

module.exports = ClassName;
```

### Error Handling

Use custom error classes from `src/errors/`:

```javascript
const { CryptoError, ConnectionError } = require('../errors');

// Throw appropriate errors
if (!isValid) {
  throw new CryptoError('Invalid key format', 'E_CRYPTO_002');
}
```

### Testing

- Write tests for all new functionality
- Place tests in `__tests__/` mirroring `src/` structure
- Aim for **>80% code coverage** (100% for crypto)
- Use descriptive test names

```javascript
describe('ClassName', () => {
  describe('methodName()', () => {
    test('does something specific', () => {
      // Arrange
      const instance = new ClassName();

      // Act
      const result = instance.methodName();

      // Assert
      expect(result).toBe(expected);
    });

    test('throws error for invalid input', () => {
      expect(() => instance.methodName(null)).toThrow(SomeError);
    });
  });
});
```

Run tests:
```bash
npm test                    # Run all tests
npm test -- --watch         # Watch mode
npm test -- --coverage      # With coverage
npm test -- path/to/test    # Specific test
```

## Pull Request Process

### Before Submitting

1. **Run tests**: `npm test`
2. **Run linter**: `npm run lint`
3. **Check coverage**: `npm test -- --coverage`
4. Update documentation if needed
5. Add tests for new features

### PR Guidelines

1. Create a feature branch from `master`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes with clear, focused commits

3. Write a clear PR description:
   - What changes were made
   - Why the changes were made
   - How to test the changes

4. Ensure CI passes (tests, linting)

5. Request review from maintainers

### Commit Messages

Follow conventional commit format:

```
type(scope): brief description

Longer description if needed.

Fixes #123
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `test`: Tests
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `chore`: Maintenance

Examples:
```
feat(hooks): add useMesh hook for React Native
fix(transport): handle BLE disconnection gracefully
docs(readme): update installation instructions
test(crypto): add Ed25519 test vectors
```

## Architecture Guidelines

### Module Dependencies

```
index.js (entry point)
    ↓
service/MeshService.js (orchestrator)
    ├→ crypto/ (no external deps)
    ├→ protocol/ (depends on crypto)
    ├→ mesh/ (depends on protocol, crypto)
    ├→ transport/ (depends on protocol)
    └→ storage/ (depends on protocol)
```

**Rules:**
- No circular dependencies
- Lower layers don't depend on higher layers
- Utils and errors can be used anywhere

### Adding New Features

1. **Discuss first**: Open an issue to discuss the feature
2. **Design**: Consider how it fits with existing architecture
3. **Implement**: Follow existing patterns
4. **Test**: Write comprehensive tests
5. **Document**: Update API docs and examples

### Performance Considerations

- Use `BoundedMap` for caches (prevents memory leaks)
- Use `TimeoutManager` for timeouts (prevents memory leaks)
- Use optimized `base64` module (not string concatenation)
- Batch async operations when possible
- Profile before and after changes

## Security Guidelines

- **Never log secrets** (keys, tokens, passwords)
- Use **constant-time comparisons** for sensitive data
- Follow existing crypto patterns
- Report security issues privately to maintainers

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Open a GitHub Issue
- **Security**: Email maintainers directly

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
