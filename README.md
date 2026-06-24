# SimTest: Autonomous Web Testing via Neural World Models

[![Node.js CI](https://github.com/your-org/simtest/actions/workflows/simtest-ci.yml/badge.svg)](https://github.com/your-org/simtest/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview
SimTest is a research-grade, world-model-based autonomous web testing framework. Inspired by DeepMind's Dreamer architecture, SimTest uses a combination of BFS state-space exploration via Playwright and a multi-agent LLM system to navigate web applications, detect bugs, and generate test specifications. 

## Features
* **GraphSAGE World Model**: Encodes raw DOM states into latent vectors.
* **Curiosity-Driven Exploration**: Calculates Cosine Similarity over a latent memory buffer to encourage discovery of novel states.
* **Uncertainty-Aware Risk Predictions**: Uses Monte Carlo Dropout to output `mean ± std` risk scores for crashes, security flaws, and auth bypasses.
* **Automated Playwright Specs**: Auto-generates reproducible `.spec.js` scripts for every bug discovered.
* **Statistical Benchmarking**: Built-in Welch's t-test and Mann-Whitney U testing to mathematically prove exploration efficiency against baseline LLM/BFS strategies.

## Architecture
See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed diagrams.

## Tech Stack
* **Engine:** Node.js, Playwright, Cheerio
* **Neural Microservice:** Python, FastAPI, PyTorch Geometric
* **Demo Target:** React 18, Vite

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-org/simtest.git
cd simtest

# 2. Install Node dependencies
npm install

# 3. Install Python dependencies
cd world-model-service
pip install -r requirements.txt
```

## Configuration & Environment Variables
Create a `.env` file in `simtest-core/`:
```env
GEMINI_API_KEY="your-google-gemini-key"
NEURAL_WM_URL="http://127.0.0.1:8000/predict"
USE_NEURAL_WM="true"
```

## Local Development
To run the full stack locally:
1. Start the Demo React App: `npm run demo`
2. Start the Neural Service: `cd world-model-service && uvicorn main:app --port 8000`
3. Run SimTest Explorer: `cd simtest-core && node src/index.js`

## Running Tests
Tests are currently under active development. (See TEST_STRATEGY.md)

## Deployment
SimTest can run fully headlessly in CI pipelines. See `.github/workflows/simtest-ci.yml`.

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md).

## License
MIT License.
