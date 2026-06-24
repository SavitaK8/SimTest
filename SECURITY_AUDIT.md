# Security Audit: SimTest

## Executive Summary
A comprehensive security scan of the SimTest repository has been performed. **CRITICAL vulnerabilities were identified**, including a committed production API key. Immediate remediation is required before this repository can be released or used publicly.

## 🔴 Critical Vulnerabilities

### 1. Hardcoded / Committed Secrets
* **Finding:** A live Google Gemini API key is currently committed in the file `simtest-core/.env`.
* **Details:** `GEMINI_API_KEY=REDACTED`
* **Remediation:** The API key must be immediately revoked. The `.env` file must be deleted from the Git history using BFG or `git filter-repo`, or added to a `.gitignore` if the repository has not yet been pushed to a remote server.

### 2. Information Disclosure via Query Parameters
* **Finding:** In `simtest-core/src/test-llm.js` (L12), the API key is passed directly in the URL query string: `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`.
* **Impact:** Query parameters are often logged by intermediate proxies, network appliances, and DNS logs, leading to credential leakage.
* **Remediation:** Pass the API key using the `x-goog-api-key` header instead of the URL query parameter.

## 🟠 Medium Vulnerabilities

### 1. Missing Security Configurations
* **Finding:** There is no `.gitignore` file anywhere in the repository.
* **Impact:** High probability of developers accidentally committing secrets, `.env` files, or multi-gigabyte datasets (like `transitions-dataset.jsonl`).
* **Remediation:** Create a strict `.gitignore` for Node.js and Python projects immediately.

### 2. Lack of Authentication on Neural Service
* **Finding:** The FastAPI `world-model-service` exposes endpoints (`/predict`, `/remember`) on `0.0.0.0:8000` with zero authentication or rate-limiting.
* **Impact:** If exposed to the internet, attackers could arbitrarily inject memory data into the latent memory buffer, polluting the world model, or perform Denial of Service via expensive PyTorch graph calculations.
* **Remediation:** Bind to `127.0.0.1` locally, and add basic API key authentication if containerized for external deployment.

## 🟡 Low / Informational Vulnerabilities

### 1. Weak Error Handling
* **Finding:** Several catch blocks in `collector.js` silently swallow errors.
* **Impact:** Fails to fail-securely. Malicious application behaviors might bypass state logging undetected.

### 2. Command Injection Risk
* **Finding:** `run-benchmark-suite.js` uses `execSync` and `spawn` to run shell commands.
* **Impact:** While currently hardcoded, if arguments were ever provided dynamically via user input, this would pose an immediate command injection risk. All `execSync` targets are currently static.
