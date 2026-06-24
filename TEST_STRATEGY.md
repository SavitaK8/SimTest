# Test Strategy: SimTest

## Overview
Given the complex nature of the SimTest framework (combining asynchronous browser automation with deep learning microservices), our testing strategy uses a layered approach. We employ **Jest** for the Node.js core and **PyTest** for the Python Neural World Model.

## Unit Testing Layer (Target: 90% Coverage)

### Node.js Core (`simtest-core/`)
* **Framework:** Jest
* **Mocking:** 
  * `playwright`: Mocked to prevent launching real browsers during unit tests.
  * `axios`: Mocked for network requests to the Neural Service.
  * `@google/generative-ai`: Mocked to avoid incurring LLM API costs.
* **Target Components:** `bug-finder.js`, `dom-to-graph.js`, `feature-extractor.js`, `fingerprint.js`, `state-graph.js`, `statistical-significance.js`. These are pure functions and data structures that require robust edge-case testing.

### Python Service (`world-model-service/`)
* **Framework:** PyTest
* **Target Components:** `Encoder`, `FusionEncoder`, `TransitionNetwork`, `RiskHead`.
* **Strategy:** Instantiate PyTorch modules with synthetic randomized tensors (e.g., `torch.randn`) to assert output shapes, non-NaN results, and correct backpropagation capabilities (even if training is offline).

## Integration Testing Layer (Target: 80% Coverage)
* **API Contracts:** Test the FastAPI endpoints (`/predict`, `/predict_uncertain`, `/remember`) using `TestClient` to ensure they gracefully handle malformed JSON and edge cases.
* **Service Interactions:** Create a mock Node server that acts as the `collector` and verifies that the `world-model` successfully communicates with the Python backend.

## End-to-End Testing Layer
* **Target:** Spin up the Vite `demo-app` on port 5173, launch the Python server on 8000, and run the complete `simtest` CLI against it.
* **Validation:** Verify that `report.json` and `playwright.config.js` are successfully output to the `generated-tests/` directory and contain the expected bug signatures (like unprotected routes).

## Regression Testing
* Found bugs will be converted into regression tests. The `test-generator.js` currently auto-generates Playwright specs for target apps; we will write tests *for* the `test-generator.js` to ensure its AST manipulation stays correct.
