# Quality Review Report: SimTest

## Code Quality

### Anti-Patterns Identified
1. **God Classes**: `Explorer.js` (360 lines) and `ReportGenerator.js` (272 lines) have too many responsibilities. `Explorer` handles action execution, planning, LLM fallback parsing, dataset writing, and state validation.
2. **Hardcoded Configurations**: `bug-finder.js` has hardcoded "dangerous route" strings and URL assumptions. `test-generator.js` has a hardcoded localhost Vite URL.
3. **Missing Typing (SOLID Violation)**: Function interfaces change dynamically. In `world-model.js`, `action` is sometimes a string, sometimes an object with a `.type` property, leading to unpredictable crashes if the upstream LLM formats JSON incorrectly.
4. **Poor Abstractions**: The Python PyTorch models do not define an explicit device (e.g. `cuda` vs `cpu`). Tensors are explicitly allocated using `torch.zeros` and `.float()` indiscriminately, risking GPU/CPU mismatch errors if deployed on a CUDA machine.

### Security
1. **Critical:** API Keys hardcoded in `.env` and committed to repo.
2. **Critical:** `test-llm.js` passes the API key as a query parameter (`?key=...`), exposing it to proxy logs.
3. **Medium:** Missing `.gitignore` means sensitive files are inherently tracked.
4. **Medium:** Python `main.py` has no authentication; anybody could hit port 8000 and pollute the neural latent buffer.
5. **Low:** `execSync` is used without shell sanitization. While the inputs are currently static strings (`node src/index.js`), this pattern is highly dangerous if arguments are parameterized later.

### Performance
1. **Inefficient Algorithms:** `collector.getInteractiveElements()` uses `page.evaluate` iteratively for hundreds of DOM elements, causing severe IPC overhead with Chromium.
2. **Blocking Operations:** Dataset writes in `explorer.js` (`fs.appendFileSync`) block the Node.js event loop during high-speed BFS traversal.
3. **Memory Leaks:** `world-model.js` creates continuous axial requests without explicitly closing TCP connections, potentially exhausting sockets on long runs.
4. **O(N) Lookups:** The curiosity buffer in `main.py` calculates cosine similarity iteratively using `torch.max()`. For $N=10000$, this will significantly degrade prediction times over long trajectories. A vector database (like FAISS) is required.
