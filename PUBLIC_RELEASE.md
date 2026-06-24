# Public Release Notes: SimTest v1.0.0 "Dreamer"

## Welcome to SimTest
SimTest is an open-source, autonomous web testing framework powered by generative AI and Graph Neural Networks. It moves beyond traditional random-walk fuzzing by employing an **Uncertainty-Aware World Model** to dream about future application states, evaluate risk, and optimize test coverage mathematically.

## What's Included in v1.0.0
* **Automated Bug Discovery:** Autonomously detects JavaScript crashes, network failures, auth bypasses, and unhandled NaN/undefined exceptions in React/Vue/Angular apps.
* **GraphSAGE World Model:** Encodes raw DOM states into a topological latent space using PyTorch.
* **Curiosity-Driven Exploration:** A latent memory buffer guides the system to mathematically novel application states using Cosine Similarity.
* **Auto-Generated Tests:** Every discovered bug automatically outputs a standalone Playwright `.spec.js` script to seamlessly drop into your CI/CD pipelines.
* **Statistical Benchmarking:** Built-in tools for Welch's t-test and Cohen's d to rigorously prove exploration improvements.

## Repository Topics
`#ai-testing` `#world-models` `#playwright` `#pytorch` `#graphsage` `#machine-learning` `#autonomous-agents`

## Known Limitations
* High memory usage during very deep explorations (>200 states) due to the naive PyTorch `deque` memory buffer.
* The Playwright State Collector relies heavily on iterative DOM querying, which may block the thread on exceptionally large enterprise applications.

## Roadmap (v1.1)
* **TypeScript Migration:** Full type safety across the Node.js engine.
* **FAISS Integration:** $O(1)$ memory buffer lookups.
* **Authentication Plugins:** Support for bypassing generic Auth0 / Okta gates during state collection.
