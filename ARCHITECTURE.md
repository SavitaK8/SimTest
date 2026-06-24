# Architecture Assessment: SimTest

## Project Purpose
SimTest is a world-model-based autonomous web testing framework. It uses a combination of BFS state-space exploration via Playwright and a multi-agent LLM system to navigate web applications, detect bugs, and generate test specifications. It features a neural microservice (PyTorch) using GraphSAGE and a Latent Memory Buffer to predict next-state transitions and provide uncertainty-aware risk analysis via Monte Carlo Dropout.

## Architecture Diagram

```mermaid
graph TD
    A["Browser (Playwright)"] -->|captureState| B["State Collector (Node.js)"]
    B --> C["DOM-to-Graph Parser"]
    C -->|"10-dim node features"| D["GraphSAGE Encoder (Python/FastAPI)"]
    D --> E["Fusion Encoder"]
    E -->|"Latent z"| F["Transition Network T"]
    E -->|"Latent z"| G["Risk Head R (MC Dropout)"]
    F -->|"z_next"| H["Curiosity Buffer"]
    H -->|"Cosine Novelty"| I["Dreamer Engine (Node.js)"]
    G -->|"risk ± uncertainty"| I
    I -->|"Best Dream"| A
    B --> J["Bug Finder"]
    J --> K["Test Generator"]
    K --> L["Playwright Specs"]
```

## Tech Stack
* **Core Engine:** Node.js, JavaScript (ESM & CommonJS)
* **Browser Automation:** Playwright
* **DOM Parsing:** Cheerio
* **Graph Algorithms:** `@dagrejs/graphlib`
* **LLM Integration:** `@google/generative-ai` (Gemini)
* **Neural Microservice:** Python 3.10, FastAPI, Uvicorn, PyTorch, PyTorch Geometric
* **Demo Application:** React 18, Vite, React Router
* **Visual Dashboard:** Vanilla HTML/CSS/JS

## Deployment Process
* Dockerfile provided for `simtest-core` (`node:20-bullseye`).
* CI/CD via GitHub Actions (`.github/workflows/simtest-ci.yml`), which automatically runs the test suite and posts a PR summary.

## External Services & APIs
* **Google Gemini API:** For LLM-based action generation.
* **Neural World Model API:** Runs locally on port 8000.

## Database Schema
* No persistent database. State transitions are logged to `transitions-dataset.jsonl`. Latent memory buffer is held in memory (`deque(maxlen=10000)`).
