# Contributing to Cognipeer Console SDK

Thank you for your interest in contributing to Cognipeer Console SDK! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions with the community.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/console-sdk.git
   cd console-sdk
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Running Tests

```bash
npm test
```

### Building the Project

```bash
npm run build
```

### Running Documentation Locally

```bash
npm run docs:dev
```

### Linting and Formatting

```bash
npm run lint
npm run format
```

## Submitting Changes

1. Make your changes in your feature branch
2. Write or update tests as needed
3. Ensure all tests pass
4. Update documentation if needed
5. Commit your changes with a clear message:
   ```bash
   git commit -m "feat: add new feature"
   ```
6. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
7. Create a Pull Request

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Test changes
- `chore:` Build process or auxiliary tool changes

## Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Include tests for new functionality
- Update documentation as needed
- Ensure CI checks pass
- Respond to review feedback promptly

## Reporting Issues

When reporting issues, please include:

- SDK version
- Node.js version
- Operating system
- Clear reproduction steps
- Expected vs actual behavior
- Error messages or logs

## Questions?

Feel free to open a discussion or issue if you have questions!

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
