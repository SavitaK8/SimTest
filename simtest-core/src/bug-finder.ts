/**
 * @module bug-finder
 * @description Bug Finder — analyses state snapshots for anomalies such as JS
 * crashes, network errors, NaN/undefined in the UI, dead-end pages, console
 * errors, and unprotected routes.
 */

'use strict';

/**
 * @typedef {Object} Bug
 * @property {string}  id            Auto-incrementing ID like "BUG-001"
 * @property {'high'|'medium'|'low'} severity
 * @property {string}  type          Category key
 * @property {string}  description   Human-readable summary
 * @property {Object}  state         { url, timestamp }
 * @property {Object}  action        { type, selector, value }
 * @property {Object}  evidence      { errors, screenshot }
 * @property {Array}   reproducePath Filled in later by TestGenerator
 */

class BugFinder {
  _bugs: any[];
  _nextId: number;

  constructor() {
    /** @type {Bug[]} */
    this._bugs = [];
    /** @type {number} */
    this._nextId = 1;
  }

  /* ---------------------------------------------------------------------- */
  /*  Public API                                                             */
  /* ---------------------------------------------------------------------- */

  /**
   * Analyse a state for bugs, optionally comparing to a previous state.
   * @param {import('./collector').StateSnapshot} state
   * @param {import('./collector').StateSnapshot|null} previousState
   * @param {Object|null} action  { type, selector, value }
   * @returns {Bug[]}  Array of bugs found in this state
   */
  analyze(state, previousState, action) {
    const found = [];

    const checks = [
      this._checkJSErrors(state),
      this._checkNetworkErrors(state),
      this._checkNaNUndefined(state),
      this._checkDeadEnd(state),
      this._checkConsoleErrors(state),
      this._checkUnprotectedRoute(state, previousState),
    ];

    for (const result of checks) {
      if (!result) continue;
      const bug = this._createBug(result, state, action);
      found.push(bug);
      this._bugs.push(bug);
    }

    return found;
  }

  /**
   * Return all bugs found so far.
   * @returns {Bug[]}
   */
  getBugs() {
    return [...this._bugs];
  }

  /* ---------------------------------------------------------------------- */
  /*  Detection methods (private)                                            */
  /* ---------------------------------------------------------------------- */

  /**
   * JS page errors (pageerror events) → HIGH severity.
   * @param {Object} state
   * @returns {Object|null}
   */
  _checkJSErrors(state) {
    const jsErrors = (state.consoleErrors || []).filter((e) =>
      e.startsWith('[pageerror]')
    );
    if (jsErrors.length === 0) return null;
    return {
      severity: 'high',
      type: 'js_crash',
      description: `JavaScript error on page: ${jsErrors[0].substring(0, 200)}`,
      errors: jsErrors,
    };
  }

  /**
   * 4xx / 5xx network responses → HIGH severity.
   * @param {Object} state
   * @returns {Object|null}
   */
  _checkNetworkErrors(state) {
    const errs = state.networkErrors || [];
    if (errs.length === 0) return null;
    const summary = errs
      .map((e) => `${e.status} ${e.url}`)
      .slice(0, 5)
      .join('; ');
    return {
      severity: 'high',
      type: 'network_error',
      description: `Network error(s): ${summary}`,
      errors: errs,
    };
  }

  /**
   * Literal "NaN" or "undefined" visible in body text → HIGH severity.
   * Uses word-boundary matching to avoid false positives.
   * @param {Object} state
   * @returns {Object|null}
   */
  _checkNaNUndefined(state) {
    const text = state.bodyText || '';
    // Match standalone NaN or undefined (not inside longer words)
    const nanMatch = /\bNaN\b/.test(text);
    const undefMatch = /\bundefined\b/.test(text);
    if (!nanMatch && !undefMatch) return null;

    const what = [];
    if (nanMatch) what.push('NaN');
    if (undefMatch) what.push('undefined');

    return {
      severity: 'high',
      type: 'nan_in_ui',
      description: `Found ${what.join(' and ')} rendered in the UI at ${state.url}`,
      errors: what,
    };
  }

  /**
   * Dead-end page — no visible, enabled interactive elements → MEDIUM severity.
   * @param {Object} state
   * @returns {Object|null}
   */
  _checkDeadEnd(state) {
    const els = state.interactiveElements || [];
    const actionable = els.filter((el) => el.enabled && el.visible);
    if (actionable.length > 0) return null;
    return {
      severity: 'medium',
      type: 'dead_end',
      description: `Dead-end page with no actionable elements at ${state.url}`,
      errors: [],
    };
  }

  /**
   * Generic console errors (console.error) → MEDIUM severity.
   * Filters out items already caught by _checkJSErrors.
   * @param {Object} state
   * @returns {Object|null}
   */
  _checkConsoleErrors(state) {
    const consoleErrs = (state.consoleErrors || []).filter(
      (e) => e.startsWith('[console.error]')
    );
    if (consoleErrs.length === 0) return null;
    return {
      severity: 'medium',
      type: 'console_error',
      description: `Console error(s): ${consoleErrs[0].substring(0, 200)}`,
      errors: consoleErrs,
    };
  }

  /**
   * Unprotected route — URL contains sensitive path segments but no
   * auth cookie / token detected → HIGH severity.
   * @param {Object} state
   * @param {Object|null} _previousState  (unused but kept for API symmetry)
   * @returns {Object|null}
   */
  _checkUnprotectedRoute(state, _previousState) {
    const sensitivePatterns = ['checkout', 'profile', 'admin', 'dashboard', 'account', 'settings'];
    const urlLower = (state.url || '').toLowerCase();
    const isSensitive = sensitivePatterns.some((p) => urlLower.includes(p));
    if (!isSensitive) return null;

    // Look for common auth indicators in cookies or body text
    const bodyLower = (state.bodyText || '').toLowerCase();
    const hasAuth =
      bodyLower.includes('logged in') ||
      bodyLower.includes('welcome back') ||
      bodyLower.includes('sign out') ||
      bodyLower.includes('logout') ||
      bodyLower.includes('my account');

    // If the page looks sensitive but there's no sign of authentication
    if (!hasAuth) {
      return {
        severity: 'high',
        type: 'unprotected_route',
        description: `Potentially unprotected sensitive route: ${state.url}`,
        errors: [],
      };
    }

    return null;
  }

  /* ---------------------------------------------------------------------- */
  /*  Helpers                                                                */
  /* ---------------------------------------------------------------------- */

  /**
   * Build a full Bug object from a detection result.
   * @param {Object} result  { severity, type, description, errors }
   * @param {Object} state
   * @param {Object|null} action
   * @returns {Bug}
   */
  _createBug(result, state, action) {
    const id = `BUG-${String(this._nextId++).padStart(3, '0')}`;
    
    // Calculate Risk Severity Score
    let score = 1;
    if (result.type === 'unprotected_route') score = 10;
    else if (result.type === 'xss') score = 8;
    else if (result.type === 'js_crash' || result.type === 'network_error') score = 5;
    else if (result.type === 'nan_in_ui' || result.type === 'dead_end') score = 2;
    else if (result.type === 'console_error') score = 1;

    return {
      id,
      severity: result.severity,
      score: score,
      type: result.type,
      description: result.description,
      state: { url: state.url, timestamp: state.timestamp },
      action: action || { type: 'none', selector: '', value: '' },
      evidence: {
        errors: result.errors || [],
        screenshot: state.screenshot || null,
      },
      reproducePath: [],
    };
  }
}

export {  BugFinder  };
