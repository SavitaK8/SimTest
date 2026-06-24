/**
 * @module fingerprint
 * @description State Fingerprinter — converts raw state snapshots into
 * deterministic, comparable 16-character hex hash strings.  Two states with
 * the same interactive elements, URL path, and form-fill status will produce
 * the same fingerprint.
 */

'use strict';

import crypto from 'crypto';

/**
 * Compute a 16-character hex fingerprint for a state snapshot.
 *
 * Algorithm:
 *  1. Normalise the URL pathname (lowercase, strip trailing slash).
 *  2. Build element signatures: `tag:id:type:enabled:visible`.
 *  3. Build form signatures:   `key=filled|empty`.
 *  4. Sort all strings deterministically.
 *  5. Join with `|`, SHA-256 hash, take first 16 hex chars.
 *
 * @param {import('./collector').StateSnapshot} state
 * @returns {string} 16-char hex fingerprint
 */
function computeFingerprint(state) {
  const parts = [];

  // 1. URL pathname — normalised
  try {
    const u = new URL(state.url);
    let pathname = u.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    parts.push(`path:${pathname}`);
  } catch {
    parts.push(`path:${state.url}`);
  }

  // 2. Element signatures
  if (state.interactiveElements && state.interactiveElements.length > 0) {
    const sigs = state.interactiveElements.map(
      (el) =>
        `el:${el.tag}:${el.id || '_'}:${el.type || '_'}:${el.enabled}:${el.visible}`
    );
    sigs.sort();
    parts.push(...sigs);
  }

  // 3. Form field signatures
  if (state.formData) {
    const formSigs = Object.keys(state.formData)
      .sort()
      .map((key) => {
        const filled = state.formData[key] && state.formData[key].length > 0;
        return `form:${key}=${filled ? 'filled' : 'empty'}`;
      });
    parts.push(...formSigs);
  }

  // 4. Sort deterministically
  parts.sort();

  // 5. Hash
  const raw = parts.join('|');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return hash.substring(0, 16);
}

/**
 * Check whether two fingerprints are identical.
 * @param {string} fp1
 * @param {string} fp2
 * @returns {boolean}
 */
function areStatesEqual(fp1, fp2) {
  return fp1 === fp2;
}

export {  computeFingerprint, areStatesEqual  };
