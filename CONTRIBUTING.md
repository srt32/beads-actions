# Contributing to Beads Actions

Thank you for your interest in contributing! This document provides guidelines for contributing to this project.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/beads-actions.git
   cd beads-actions
   ```
3. Install dependencies:
   ```bash
   cd scripts
   npm install
   ```

## Development Workflow

### Making Changes

1. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes in the `scripts/src/` directory

3. Build the project:
   ```bash
   npm run build
   ```

4. Run tests:
   ```bash
   npm test
   ```

5. Run linter:
   ```bash
   npm run lint
   ```

### Testing

We use Jest for testing. Tests are located in `scripts/src/__tests__/`.

- Write tests for all new functionality
- Ensure existing tests pass
- Aim for high code coverage
- Use meaningful test descriptions

Example test structure:
```typescript
describe('YourFeature', () => {
  it('should do something specific', () => {
    // Test implementation
  });
});
```

### Code Style

- We use TypeScript with strict mode enabled
- Follow existing code conventions
- Use ESLint for code style checking
- Write clear, self-documenting code
- Add comments for complex logic

### Commit Messages

Use clear, descriptive commit messages:
- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit first line to 72 characters
- Reference issues and PRs when relevant

Example:
```
Add support for custom priority labels

- Allow users to configure custom label patterns
- Update tests for new functionality
- Update documentation

Fixes #123
```

## Submitting Changes

1. Push your changes to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Open a Pull Request on GitHub

3. In your PR description:
   - Describe what changes you made and why
   - Reference any related issues
   - Include screenshots for UI changes
   - List any breaking changes

4. Wait for review feedback and address any comments

## Bug Reports

When reporting bugs, please include:
- A clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)
- Relevant logs or error messages

## Feature Requests

We welcome feature requests! Please:
- Clearly describe the feature and use case
- Explain why it would be valuable
- Provide examples if possible
- Be open to discussion and iteration

## Questions?

If you have questions:
- Check the README.md first
- Look through existing issues
- Open a new issue with your question

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on what's best for the community
- Show empathy towards others

Thank you for contributing! 🎉
