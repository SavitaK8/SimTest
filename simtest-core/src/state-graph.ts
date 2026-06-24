/**
 * @module state-graph
 * @description Directed state graph built on top of @dagrejs/graphlib.
 * Each node is a unique state fingerprint, each edge is a user action that
 * transitions from one state to another.  Tracks exploration status so the
 * BFS explorer knows which states still need work.
 */

'use strict';

import {  Graph, alg  } from '@dagrejs/graphlib';

class StateGraph {
  graph: any;
  constructor() {
    /**
     * Directed, compound-capable graph.
     * Node labels store the full state data + exploration metadata.
     * Edge labels store the action that caused the transition.
     * @type {Graph}
     */
    this.graph = new Graph({ directed: true, compound: false, multigraph: true });
  }

  /* ---------------------------------------------------------------------- */
  /*  Nodes                                                                  */
  /* ---------------------------------------------------------------------- */

  /**
   * Add a state node.  If the fingerprint already exists the call is a no-op.
   * @param {string} fingerprint
   * @param {Object} stateData  — raw state snapshot (url, title, etc.)
   * @returns {boolean} `true` if the state was new
   */
  addState(fingerprint, stateData) {
    if (this.graph.hasNode(fingerprint)) return false;

    this.graph.setNode(fingerprint, {
      stateData,
      explored: false,
      exploredActions: [],
      hasBugs: false,
      bugs: [],
    });
    return true;
  }

  /**
   * Check whether the graph already contains a state.
   * @param {string} fingerprint
   * @returns {boolean}
   */
  hasState(fingerprint) {
    return this.graph.hasNode(fingerprint);
  }

  /**
   * Retrieve the full label (stateData + metadata) for a node.
   * @param {string} fingerprint
   * @returns {Object|undefined}
   */
  getState(fingerprint) {
    return this.graph.node(fingerprint);
  }

  /* ---------------------------------------------------------------------- */
  /*  Edges                                                                  */
  /* ---------------------------------------------------------------------- */

  /**
   * Add a directed transition edge.
   * @param {string} fromFp   Source state fingerprint
   * @param {string} toFp     Target state fingerprint
   * @param {Object} action   { type, selector, value }
   */
  addTransition(fromFp, toFp, action) {
    const edgeName = `${fromFp}->${toFp}::${action.type}::${action.selector || ''}`;
    this.graph.setEdge(fromFp, toFp, { action, timestamp: Date.now() }, edgeName);
  }

  /**
   * Return all outgoing transitions from a state.
   * @param {string} fingerprint
   * @returns {Array<{ target: string, action: Object }>}
   */
  getTransitions(fingerprint) {
    try {
      const edges = this.graph.outEdges(fingerprint) || [];
      return edges.map((e) => ({
        target: e.w,
        action: (this.graph.edge(e) || {}).action,
      }));
    } catch {
      return [];
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Exploration tracking                                                   */
  /* ---------------------------------------------------------------------- */

  /**
   * Get all states that have not yet been fully explored.
   * @returns {string[]} array of fingerprints
   */
  getUnexploredStates() {
    return this.graph.nodes().filter((n) => {
      const label = this.graph.node(n);
      return label && !label.explored;
    });
  }

  /**
   * Mark a state as fully explored.
   * @param {string} fingerprint
   */
  markExplored(fingerprint) {
    const label = this.graph.node(fingerprint);
    if (label) label.explored = true;
  }

  /**
   * Record that a particular action has been tried from a state.
   * @param {string} fingerprint
   * @param {string} actionKey  human-readable action identifier
   */
  recordExploredAction(fingerprint, actionKey) {
    const label = this.graph.node(fingerprint);
    if (label) label.exploredActions.push(actionKey);
  }

  /**
   * Check if an action was already tried from a state.
   * @param {string} fingerprint
   * @param {string} actionKey
   * @returns {boolean}
   */
  hasExploredAction(fingerprint, actionKey) {
    const label = this.graph.node(fingerprint);
    return label ? label.exploredActions.includes(actionKey) : false;
  }

  /* ---------------------------------------------------------------------- */
  /*  Pathfinding                                                            */
  /* ---------------------------------------------------------------------- */

  /**
   * Find the shortest path from `fromFp` to `toFp` using Dijkstra.
   * Returns an array of { fingerprint, action } steps (action on each step is
   * the action taken to reach that node from the previous one).
   * @param {string} fromFp
   * @param {string} toFp
   * @returns {Array<{ fingerprint: string, action: Object|null }>|null}
   */
  getPath(fromFp, toFp) {
    try {
      const result = alg.dijkstra(this.graph, fromFp);
      if (!result[toFp] || result[toFp].distance === Infinity) return null;

      // Rebuild path by walking predecessors
      const path = [];
      let current = toFp;
      while (current !== fromFp) {
        const pred = result[current].predecessor;
        // Find the edge label
        const edges = this.graph.outEdges(pred) || [];
        let action = null;
        for (const e of edges) {
          if (e.w === current) {
            const edgeLabel = this.graph.edge(e);
            if (edgeLabel) {
              action = edgeLabel.action;
              break;
            }
          }
        }
        path.unshift({ fingerprint: current, action });
        current = pred;
      }
      path.unshift({ fingerprint: fromFp, action: null });
      return path;
    } catch {
      return null;
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Bug tracking                                                           */
  /* ---------------------------------------------------------------------- */

  /**
   * Flag a state as containing bugs.
   * @param {string} fingerprint
   * @param {Object[]} bugs
   */
  flagBugs(fingerprint, bugs) {
    const label = this.graph.node(fingerprint);
    if (label) {
      label.hasBugs = true;
      label.bugs.push(...bugs);
    }
  }

  /**
   * Get all states that have been flagged as containing bugs.
   * @returns {Array<{ fingerprint: string, bugs: Object[] }>}
   */
  getAllBugStates() {
    return this.graph
      .nodes()
      .filter((n) => {
        const label = this.graph.node(n);
        return label && label.hasBugs;
      })
      .map((n) => ({ fingerprint: n, bugs: this.graph.node(n).bugs }));
  }

  /* ---------------------------------------------------------------------- */
  /*  Stats & serialisation                                                  */
  /* ---------------------------------------------------------------------- */

  /**
   * Quick summary statistics.
   * @returns {{ nodes: number, edges: number, explored: number, unexplored: number }}
   */
  getStats() {
    const nodes = this.graph.nodeCount();
    const edges = this.graph.edgeCount();
    const explored = this.graph.nodes().filter((n) => {
      const l = this.graph.node(n);
      return l && l.explored;
    }).length;
    return { nodes, edges, explored, unexplored: nodes - explored };
  }

  /**
   * Serialise the graph to a plain JSON-friendly object.
   * Strips screenshot buffers to keep the output small.
   * @returns {Object}
   */
  serialize() {
    const nodes = this.graph.nodes().map((n) => {
      const label = { ...this.graph.node(n) };
      // Strip heavy binary data
      if (label.stateData) {
        label.stateData = { ...label.stateData, screenshot: undefined };
      }
      return { id: n, label };
    });

    const edges = (this.graph.edges() || []).map((e) => ({
      from: e.v,
      to: e.w,
      label: this.graph.edge(e),
    }));

    return { nodes, edges };
  }

  /**
   * Rebuild a StateGraph from a previously serialised object.
   * @param {Object} json
   * @returns {StateGraph}
   */
  static deserialize(json) {
    const sg = new StateGraph();
    if (json.nodes) {
      json.nodes.forEach((n) => {
        sg.graph.setNode(n.id, n.label);
      });
    }
    if (json.edges) {
      json.edges.forEach((e) => {
        const name = `${e.from}->${e.to}::deser`;
        sg.graph.setEdge(e.from, e.to, e.label, name);
      });
    }
    return sg;
  }
}

export {  StateGraph  };
