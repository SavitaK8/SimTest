/**
 * @module collector
 * @description State Collector — connects to a running web app via Playwright,
 * captures full state snapshots including interactive elements, form data,
 * console/network errors, visible text, and screenshots.
 */

'use strict';

import {  chromium  } from 'playwright';

/**
 * @typedef {Object} InteractiveElement
 * @property {string} tag        - HTML tag name (lowercase)
 * @property {string} id         - Element id attribute
 * @property {string} type       - Input type or ''
 * @property {string} text       - Visible text / label
 * @property {boolean} enabled   - Not disabled
 * @property {boolean} visible   - Currently visible
 * @property {string} selector   - Reliable CSS selector
 * @property {string} role       - ARIA role
 * @property {string} name       - ARIA name / form name
 * @property {string} value      - Current value
 * @property {string} href       - Link href
 * @property {Object|null} boundingBox - { x, y, width, height }
 */

/**
 * @typedef {Object} StateSnapshot
 * @property {string}   url
 * @property {string}   title
 * @property {number}   timestamp
 * @property {InteractiveElement[]} interactiveElements
 * @property {Object}   formData
 * @property {string[]} consoleErrors
 * @property {Object[]} networkErrors
 * @property {string}   bodyText
 * @property {Buffer}   screenshot
 */

class StateCollector {
  baseUrl;
  headless;
  timeout;
  browser;
  context;
  page;
  _consoleErrors;
  _networkErrors;

  /**
   * @param {Object} options
   * @param {boolean} [options.headless=true]   Run browser headlessly
   * @param {number}  [options.timeout=5000]    Default action timeout (ms)
   * @param {string}  [options.baseUrl]         Base URL of the target app
   */
  constructor(options: any = {}) {
    this.headless = options.headless !== undefined ? options.headless : true;
    this.timeout = options.timeout || 30000;
    this.baseUrl = options.baseUrl || 'http://localhost:5173';

    /** @type {import('playwright').Browser|null} */
    this.browser = null;
    /** @type {import('playwright').BrowserContext|null} */
    this.context = null;
    /** @type {import('playwright').Page|null} */
    this.page = null;

    // Accumulated errors since last captureState()
    /** @type {string[]} */
    this._consoleErrors = [];
    /** @type {Object[]} */
    this._networkErrors = [];
  }

  /* ---------------------------------------------------------------------- */
  /*  Lifecycle                                                              */
  /* ---------------------------------------------------------------------- */

  /**
   * Launch the browser, create a context and page, and wire up listeners.
   */
  async init() {
    try {
      this.browser = await chromium.launch({ headless: this.headless });
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,
      });
      this.page = await this.context.newPage();
      this.page.setDefaultTimeout(this.timeout);

      // --- Capture JS errors thrown on the page ---
      this.page.on('pageerror', (err) => {
        this._consoleErrors.push(`[pageerror] ${err.message}`);
      });

      // --- Capture console.error / console.warn ---
      this.page.on('console', (msg) => {
        if (msg.type() === 'error') {
          this._consoleErrors.push(`[console.error] ${msg.text()}`);
        }
      });

      // --- Capture 4xx / 5xx network responses ---
      this.page.on('response', (response) => {
        const status = response.status();
        if (status >= 400) {
          this._networkErrors.push({
            url: response.url(),
            status,
            statusText: response.statusText(),
            timestamp: Date.now(),
          });
        }
      });
    } catch (err) {
      throw new Error(`StateCollector.init failed: ${err.message}`);
    }
  }

  /**
   * Close browser and clean up.
   */
  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.context = null;
        this.page = null;
      }
    } catch (err) {
      // swallow — we're shutting down
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Navigation                                                             */
  /* ---------------------------------------------------------------------- */

  /**
   * Navigate the page to `url` and wait for network idle.
   * @param {string} url
   */
  async navigateTo(url) {
    try {
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: this.timeout * 2 });
    } catch (err) {
      // Timeout during navigation is non-fatal — continue with whatever loaded
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  State capture                                                          */
  /* ---------------------------------------------------------------------- */

  /**
   * Capture a full state snapshot of the current page.
   * @returns {Promise<StateSnapshot>}
   */
  async captureState() {
    try {
      const url = this.page.url();
      const title = await this.page.title();
      const interactiveElements = await this.getInteractiveElements();
      const formData = await this._extractFormData();
      const bodyText = await this._extractBodyText();
      const screenshot = await this.page.screenshot({ type: 'png' });

      // Drain accumulated errors
      const consoleErrors = [...this._consoleErrors];
      const networkErrors = [...this._networkErrors];
      this._consoleErrors = [];
      this._networkErrors = [];

      return {
        url,
        title,
        timestamp: Date.now(),
        interactiveElements,
        formData,
        consoleErrors,
        networkErrors,
        bodyText,
        screenshot,
      };
    } catch (err) {
      throw new Error(`captureState failed: ${err.message}`);
    }
  }

  /**
   * Enumerate all actionable (interactive) elements on the page.
   * @returns {Promise<InteractiveElement[]>}
   */
  async getInteractiveElements() {
    try {
      const elements = await this.page.evaluate(() => {
        /**
         * Build a reliable CSS selector for an element.
         * Priority: #id → [data-testid] → tag:nth-of-type
         */
        function buildSelector(el: any) {
          if (el.id) return `#${CSS.escape(el.id)}`;
          if (el.dataset && el.dataset.testid) {
            return `[data-testid="${el.dataset.testid}"]`;
          }
          // Fall back to tag:nth-of-type inside parent
          const parent = el.parentElement;
          if (!parent) return el.tagName.toLowerCase();
          const siblings = Array.from(parent.children).filter(
            (c: any) => c.tagName === el.tagName
          );
          const idx = siblings.indexOf(el) + 1;
          const parentSel = parent.id
            ? `#${CSS.escape(parent.id)}`
            : parent.tagName.toLowerCase();
          return `${parentSel} > ${el.tagName.toLowerCase()}:nth-of-type(${idx})`;
        }

        const selectors =
          'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="tab"], [onclick]';
        const nodes = document.querySelectorAll(selectors);
        const results: any[] = [];

        nodes.forEach((element: any) => {
          const el = element as any;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          const visible =
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0;

          results.push({
            tag: el.tagName.toLowerCase(),
            id: el.id || '',
            type: el.type || '',
            text: (el.textContent || '').trim().substring(0, 100),
            enabled: !el.disabled,
            visible,
            selector: buildSelector(el),
            role: el.getAttribute('role') || '',
            name: el.getAttribute('name') || el.getAttribute('aria-label') || '',
            value: el.value !== undefined ? String(el.value) : '',
            href: el.href || '',
            boundingBox: visible
              ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
              : null,
          });
        });

        return results;
      });

      return elements;
    } catch (err) {
      return [];
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Actions                                                                */
  /* ---------------------------------------------------------------------- */

  /**
   * Execute an action on an interactive element.
   * @param {InteractiveElement} element
   * @param {{ type: string, value?: string }} action
   *   type: 'click' | 'fill' | 'select' | 'check'
   */
  async executeAction(element, action) {
    try {
      const sel = element.selector;

      switch (action.type) {
        case 'click':
          await this.page.click(sel, { timeout: this.timeout });
          break;

        case 'fill':
          await this.page.fill(sel, action.value || '', { timeout: this.timeout });
          break;

        case 'select':
          await this.page.selectOption(sel, action.value || '', { timeout: this.timeout });
          break;

        case 'check':
          // Toggle checkbox / radio
          {
            const isChecked = await this.page.isChecked(sel);
            if (isChecked) {
              await this.page.uncheck(sel, { timeout: this.timeout });
            } else {
              await this.page.check(sel, { timeout: this.timeout });
            }
          }
          break;

        default:
          await this.page.click(sel, { timeout: this.timeout });
      }

      // Wait for network to settle after the action
      await this.page.waitForLoadState('networkidle', { timeout: this.timeout }).catch(() => {});
    } catch (err) {
      // Action failed — non-fatal, we record the state as-is
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Private helpers                                                        */
  /* ---------------------------------------------------------------------- */

  /**
   * Extract current form field values from the page.
   * @returns {Promise<Object>}
   */
  async _extractFormData() {
    try {
      return await this.page.evaluate(() => {
        const data = {};
        document
          .querySelectorAll('input, select, textarea')
          .forEach((el: any) => {
            const key = el.name || el.id || el.getAttribute('aria-label') || '';
            if (key) {
              data[key] = el.value || '';
            }
          });
        return data;
      });
    } catch {
      return {};
    }
  }

  /**
   * Extract visible body text for NaN / undefined detection.
   * @returns {Promise<string>}
   */
  async _extractBodyText() {
    try {
      return await this.page.evaluate(() => document.body.innerText || '');
    } catch {
      return '';
    }
  }
}

export {  StateCollector  };
