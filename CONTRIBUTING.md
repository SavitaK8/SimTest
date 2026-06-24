# Contributing to SimTest

Thank you for your interest in contributing to SimTest! 

## Development Workflow
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'feat: add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

## Coding Guidelines
* **Node.js**: Use ES6+ syntax. Avoid `var`. Prefer `const` and `let`. Ensure all asynchronous methods are properly awaited and wrapped in `try/catch` where appropriate.
* **Python**: Follow PEP-8. Use type hints for all function signatures (e.g., `def predict(data: FeaturesInput) -> dict:`).

## Testing
We require a minimum of 80% test coverage for all new features.
- Node.js tests: Run `npm run test`
- Python tests: Run `pytest`
