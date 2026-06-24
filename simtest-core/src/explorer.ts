#!/usr/bin/env node
'use strict';

import {  computeFingerprint  } from './fingerprint';
import llmClient from './llm-client';
import {  getRandomExplorerAgent  } from './agents';
import dreamer from './dreamer';
import fs from 'fs';
import path from 'path';

import worldModel from './world-model';

/**
 * Test values to try for different input types during exploration (Fallback BFS).
 */
const TEST_VALUES = {
  text: ['test', '', '<script>alert(1)</script>', 'a'.repeat(200)],
  email: ['test@example.com', 'invalid-email', ''],
  password: ['password123', ''],
  number: ['0', '1', '-1', '99999'],
  search: ['test', '<script>alert(1)</script>', ''],
  tel: ['1234567890', ''],
  url: ['https://example.com', 'not-a-url', ''],
  default: ['test', '']
};

/**
 * BFS Explorer — Systematically discovers application state space.
 */
class Explorer {
  collector: any;
  bugFinder: any;
  options: any;
  graph: any;
  queue: any[];
  stats: any;
  rootFingerprint: string | null;
  datasetPath: string;
  onProgress: any;

  constructor(collector: any, stateGraph: any, bugFinder: any, options: any = {}) {
    this.collector = collector;
    this.graph = stateGraph;
    this.bugFinder = bugFinder;
    this.options = {
      maxDepth: options.maxDepth || 10,
      maxStates: options.maxStates || 200,
      maxActionsPerState: options.maxActionsPerState || 20,
      actionTimeout: options.actionTimeout || 5000,
      startUrl: options.startUrl || 'http://localhost:5173',
      ...options
    };

    this.stats = {
      statesDiscovered: 0,
      transitionsFound: 0,
      actionsAttempted: 0,
      depthReached: 0,
      errorsEncountered: 0,
      startTime: null,
      endTime: null
    };

    this.rootFingerprint = null;
    this.queue = [];
    this.onProgress = options.onProgress || (() => {});

    // Setup dataset logging for Phase 3 World Model
    const outDir = path.resolve(process.cwd(), 'generated-tests');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    this.datasetPath = path.join(outDir, 'transitions-dataset.jsonl');
  }

  async explore(startUrl) {
    this.stats.startTime = Date.now();
    const url = startUrl || this.options.startUrl;

    try {
      await this.collector.navigateTo(url);
      await this._waitForStability();

      const initialState = await this.collector.captureState();
      const initialFp = computeFingerprint(initialState);
      this.rootFingerprint = initialFp;

      this.graph.addState(initialFp, initialState);
      this.stats.statesDiscovered = 1;
      this.queue.push({ fingerprint: initialFp, depth: 0 });

      this._reportProgress(`Initial state captured: ${initialState.url}`);

      // Phase 3A/3B: Dreamer Loop Execution
      if (llmClient.genAI || process.env.USE_NEURAL_WM === 'true') {
        this._reportProgress('🧠 Initiating World Model Dreamer Engine...');
        const bestDream = await dreamer.plan(initialState.url, 3, 3);
        
        if (bestDream && bestDream.score > 0) {
          this._reportProgress(`[Dreamer] Executing best future: ${bestDream.id} (Score: ${bestDream.score})`);
          let currentFp = initialFp;
          for (const step of bestDream.path) {
            this._reportProgress(`[Dreamer Execution] Attempting hallucinated action: ${step.action.description || step.action.type}`);
            // Force create an element stub since dream actions are hallucinated without exact DOM selectors sometimes
            const elementStub = { selector: step.action.selector || 'body', text: 'Hallucinated Element' };
            const fullAction = { ...step.action, element: elementStub };
            
            try {
              // tryAction will automatically capture the new state and log the real transitions
              await this._tryAction(fullAction, currentFp, 0);
              // We don't advance currentFp reliably because hallucinated paths might fail, 
              // but BFS will catch any newly discovered states in the queue.
            } catch (e) {
              this._reportProgress(`[Dreamer Execution] Failed to verify step: ${e.message}`);
              break; // Stop executing dream if reality diverges
            }
          }
        }
      }

      while (this.queue.length > 0 && this.stats.statesDiscovered < this.options.maxStates) {
        const { fingerprint, depth } = this.queue.shift();

        if (depth > this.options.maxDepth) continue;
        const stateLabel = this.graph.getState(fingerprint);
        if (stateLabel && stateLabel.explored) continue;

        this.stats.depthReached = Math.max(this.stats.depthReached, depth);

        await this._exploreState(fingerprint, depth);
        this.graph.markExplored(fingerprint);
      }
    } catch (error) {
      console.error('\n\n[FATAL EXPLORE ERROR]', error.stack || error, '\n\n');
      this._reportProgress(`Exploration error: ${error.message}`);
      this.stats.errorsEncountered++;
    }

    this.stats.endTime = Date.now();

    return {
      graph: this.graph,
      bugs: this.bugFinder.getBugs(),
      stats: this.getStats()
    };
  }

  async _exploreState(fingerprint, depth) {
    const stateData = this.graph.getState(fingerprint);
    if (!stateData) return;

    this._reportProgress(`Exploring state [depth=${depth}]: ${stateData.url} (${this.stats.statesDiscovered} states found)`);

    const reachedState = await this._navigateToState(fingerprint);
    if (!reachedState) {
      this._reportProgress(`Could not navigate to state ${fingerprint.slice(0, 8)}...`);
      return;
    }

    const elements = await this.collector.getInteractiveElements();
    
    // Phase 2: LLM Guided Action Planning
    let actionsToTry = await this._planActionsLLM(elements, stateData.url);
    if (!actionsToTry || actionsToTry.length === 0) {
      this._reportProgress('LLM returned no actions, falling back to BFS strategy...');
      actionsToTry = this._planActionsFallback(elements);
    }
    
    let actionCount = 0;
    for (const action of actionsToTry) {
      if (actionCount >= this.options.maxActionsPerState) break;
      if (this.stats.statesDiscovered >= this.options.maxStates) break;

      try {
        await this._tryAction(action, fingerprint, depth);
        actionCount++;
        this.stats.actionsAttempted++;
      } catch (error) {
        this.stats.errorsEncountered++;
      }

      try {
        await this._navigateToState(fingerprint);
      } catch (e) {
        break;
      }
    }
  }

  /**
   * Phase 2: Use LLM and Agent Personas to plan actions intelligently.
   */
  async _planActionsLLM(elements, url) {
    if (!llmClient.genAI) return null; // Fallback if no API key

    const agent = getRandomExplorerAgent();
    this._reportProgress(`🤖 Using ${agent.name} to analyze state at ${url}`);

    // Map elements to a simpler format for the LLM prompt
    const elPrompt = elements.filter(e => e.visible && e.enabled).map(e => ({
      selector: e.selector,
      tag: e.tag,
      type: e.type,
      text: e.text
    }));

    if (elPrompt.length === 0) return [];

    const promptText = `
Current URL: ${url}
Available Elements:
${JSON.stringify(elPrompt, null, 2)}

Provide your chosen actions as a JSON array according to the schema.
`;

    const llmResult = await llmClient.ask(agent.getSystemPrompt(), promptText);
    if (!llmResult || !Array.isArray(llmResult)) return null;

    // Validate and map the LLM actions back to full element objects
    const finalActions = [];
    for (const res of llmResult) {
      const match = elements.find(e => e.selector === res.selector);
      if (match) {
        finalActions.push({
          type: res.type || 'click',
          element: match,
          selector: match.selector,
          value: res.value,
          description: `[${agent.name}] ${res.type} ${match.selector} ${res.value ? 'with '+res.value : ''}`
        });
      }
    }

    return finalActions;
  }

  /**
   * Phase 1: Original BFS exhaustive plan. Used as fallback.
   */
  _planActionsFallback(elements) {
    const actions = [];
    for (const el of elements) {
      if (!el.visible || !el.enabled) continue;

      const tag = (el.tag || '').toLowerCase();
      const type = (el.type || '').toLowerCase();
      const role = (el.role || '').toLowerCase();

      if (tag === 'a' || tag === 'button' || role === 'button' || role === 'link') {
        actions.push({ type: 'click', element: el, selector: el.selector, description: `Click "${el.text || el.selector}"` });
      } else if (tag === 'input' || tag === 'textarea') {
        if (type === 'checkbox' || type === 'radio') {
          actions.push({ type: 'check', element: el, selector: el.selector, description: `Toggle ${el.selector}` });
        } else if (type === 'submit') {
          actions.push({ type: 'click', element: el, selector: el.selector, description: `Click submit ${el.selector}` });
        } else {
          const inputType = type || 'default';
          const values = TEST_VALUES[inputType] || TEST_VALUES.default;
          for (const value of values) {
            actions.push({ type: 'fill', element: el, selector: el.selector, value: value, description: `Fill ${el.selector} with "${value.slice(0, 30)}"` });
          }
        }
      } else if (tag === 'select') {
        actions.push({ type: 'select', element: el, selector: el.selector, description: `Select option in ${el.selector}` });
      }
    }
    return actions;
  }

  async _tryAction(action, currentFp, depth) {
    const previousState = this.graph.getState(currentFp);

    try {
      await this.collector.executeAction(action.element, { type: action.type, value: action.value });
      await this._waitForStability();

      const newState = await this.collector.captureState();
      const newFp = computeFingerprint(newState);

      const bugs = this.bugFinder.analyze(newState, previousState, action);
      if (bugs.length > 0) {
        this._reportProgress(`🐛 Found ${bugs.length} bug(s) after: ${action.description}`);
      }

      const isNew = this.graph.addState(newFp, newState);
      this.graph.addTransition(currentFp, newFp, {
        type: action.type, selector: action.selector, value: action.value, description: action.description
      });
      this.stats.transitionsFound++;

      // Phase 2: Log dataset transitions for Phase 3 World Model
      const triple = {
        state: previousState.url,
        domCount: previousState.domElements ? previousState.domElements.length : 0,
        action: action,
        nextState: newState.url,
        nextDomCount: newState.domElements ? newState.domElements.length : 0,
        timestamp: new Date().toISOString()
      };
      fs.appendFileSync(this.datasetPath, JSON.stringify(triple) + '\\n');

      if (isNew) {
        this.stats.statesDiscovered++;
        this._reportProgress(`✨ New state [${this.stats.statesDiscovered}]: ${newState.url} (via ${action.description})`);
        
        // Phase 7: Update Python Latent Memory Buffer
        await worldModel.remember(newState);

        if (depth + 1 <= this.options.maxDepth) {
          this.queue.push({ fingerprint: newFp, depth: depth + 1 });
        }
      }
    } catch (error) {
      this._reportProgress(`⚠ Action failed: ${action.description} — ${error.message}`);
      try {
        const errorState = await this.collector.captureState();
        this.bugFinder.analyze(errorState, previousState, action);
      } catch (e) {}
    }
  }

  async _navigateToState(targetFp) {
    if (targetFp === this.rootFingerprint) {
      await this.collector.navigateTo(this.options.startUrl);
      await this._waitForStability();
      return true;
    }

    const path = this.graph.getPath(this.rootFingerprint, targetFp);
    if (!path || path.length === 0) {
      const stateData = this.graph.getState(targetFp);
      if (stateData && stateData.url) {
        await this.collector.navigateTo(stateData.url);
        await this._waitForStability();
        return true;
      }
      return false;
    }

    await this.collector.navigateTo(this.options.startUrl);
    await this._waitForStability();

    for (const step of path) {
      if (step.action) {
        try {
          await this.collector.executeAction({ selector: step.action.selector }, { type: step.action.type, value: step.action.value });
          await this._waitForStability();
        } catch (error) {
          const targetState = this.graph.getState(targetFp);
          if (targetState && targetState.url) {
            await this.collector.navigateTo(targetState.url);
            await this._waitForStability();
          }
          return true;
        }
      }
    }
    return true;
  }

  async _waitForStability() {
    try { await this.collector.page.waitForLoadState('networkidle', { timeout: 3000 }); } catch (e) {}
    await this.collector.page.waitForTimeout(500);
  }

  _reportProgress(message) { this.onProgress(message, this.getStats()); }
  getStats() { return { ...this.stats, duration: this.stats.endTime ? this.stats.endTime - this.stats.startTime : Date.now() - (this.stats.startTime || Date.now()), queueSize: this.queue.length }; }
}

export {  Explorer  };
