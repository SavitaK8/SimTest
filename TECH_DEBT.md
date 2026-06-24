# Technical Debt: SimTest

## Missing Documentation
* **CRITICAL:** Missing `README.md` at project root. No setup or execution instructions available.
* **CRITICAL:** Missing `.gitignore` at project root. Node modules, python cache, and sensitive `.env` files are tracked or un-ignored.
* **CRITICAL:** Missing `LICENSE` file.
* Missing API Documentation for the Python World Model Service.

## Code Quality Issues
* The project lacks TypeScript entirely. Type safety relies solely on duck typing, creating fragile boundaries between the DOM parsers, Graph builders, and neural models.
* No Linter configuration (e.g. ESLint, Prettier).
* No unit tests or integration tests exist in the codebase.
* `main.py` lacks robust error handling (no try/except blocks), relying entirely on FastAPI's default 500 responses if matrix dimensions or operations fail.
* Several files have "swallowed" errors (`catch { }` blocks that do nothing), making debug loops difficult.

## Design Patterns / Coupling
* High coupling between `collector.js` and Playwright internals. Mocking out the browser for fast, headless unit tests will be extremely difficult.
* The API key logic is hardcoded across multiple files rather than centralized via a config/environment module.
