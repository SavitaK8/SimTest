# Codebase Analysis: SimTest

## Overview
The codebase is structured as an npm monorepo with three main components: `simtest-core` (the node-based testing engine), `world-model-service` (the Python-based neural network server), and `demo-app` (the React-based application under test). The project is purely JavaScript (no TypeScript) on the Node side. 

## Folder Structure
```
simtest/
├── .github/workflows/          # CI/CD pipelines
├── dashboard/                  # Vanilla HTML/CSS/JS frontend for results
├── demo-app/                   # React target application (ShopSim)
├── simtest-core/               # The Node.js testing engine
│   ├── src/                    # Source code files (20 files)
│   ├── generated-tests/        # Playwright outputs and metric reports
│   └── .env                    # Environment variables
└── world-model-service/        # The Python FastAPI microservice
    └── main.py                 # GraphSAGE / Transition models
```

## Data Flow
1. **Collector** uses Playwright to capture the current DOM and visible context.
2. **DOM-to-Graph** converts HTML into a PyTorch Geometric compatible node/edge structure.
3. **World Model** submits graph to `world-model-service`.
4. **Python Microservice** runs GraphSAGE, predicts risks, generates next latent state $z$.
5. **Dreamer** imagines multiple possible trajectories, calculates cosine similarity for novelty.
6. **Explorer** executes best action from the Dreamer.
7. **Bug Finder** validates if the new state contains JavaScript errors, dead ends, or unauthorized routes.
8. **Test Generator** produces Playwright `.spec.js` reproducing the bug.

## Duplicate / Dead Code
* The `world-model-service` includes a legacy `Novelty` output in the RiskHead, which is currently unused as novelty is now calculated via cosine similarity over the memory buffer in `/intrinsic_reward`.
* Fallback LLM action planning logic is heavily duplicated across `explorer.js` and `dreamer.js`.

## Performance Bottlenecks
* The `StateCollector` currently evaluates every element interactively. On very large DOMs, `getInteractiveElements` will block heavily.
* Synchronous file writing of the `transitions-dataset.jsonl` in a hot loop could cause severe I/O blocking during long explorations.
* The `world-model-service` memory buffer is a simple Python `deque`. Linear cosine similarity calculation against up to 10,000 vectors will drastically slow down prediction speed. Needs a FAISS index.
