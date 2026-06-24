import * as cheerio from 'cheerio';

class DOMToGraph {
    /**
     * Parses an HTML string into a Graph representation for PyTorch Geometric
     * @param {string} html 
     * @returns {Object} { x: [[float]], edge_index: [[int], [int]] }
     */
    static parse(html) {
        if (!html) {
            // Return empty graph
            return { x: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]], edge_index: [[0], [0]] };
        }

        const $ = cheerio.load(html);
        const x = [];
        const sourceNodes = [];
        const targetNodes = [];

        // Assign numeric IDs to nodes
        let nextId = 0;
        const nodeMap = new Map(); // DOM element -> integer ID

        // Helper to get tag integer mapping
        function getTagInt(tagName) {
            const map = { 'button': 1, 'a': 2, 'input': 3, 'form': 4, 'div': 5, 'span': 6, 'li': 7, 'ul': 8, 'nav': 9, 'header': 10 };
            return map[tagName] || 0;
        }

        // Helper for aria roles
        function getRoleInt(roleName) {
            const map = { 'button': 1, 'link': 2, 'dialog': 3, 'alert': 4, 'form': 5, 'navigation': 6, 'search': 7, 'textbox': 8, 'menu': 9, 'checkbox': 10 };
            return map[roleName] || 0;
        }

        // 1. First Pass: Create nodes (x)
        $('*').each((_, el) => {
            const $el = $(el);
            const nodeId = nextId++;
            nodeMap.set(el, nodeId);

            const n = el as any;
            const tagName = (n.name || '').toLowerCase();
            const tagInt = getTagInt(tagName);

            const attribs = n.attribs || {};
            
            // Core Heuristics
            const isClickable = (tagName === 'button' || tagName === 'a' || attribs.role === 'button' || attribs.onclick) ? 1 : 0;
            const isEnabled = (attribs.disabled !== undefined) ? 0 : 1;
            const isVisible = (attribs.hidden !== undefined || (attribs.style && attribs.style.includes('display: none'))) ? 0 : 1;

            // Advanced Research Features
            const depth = $el.parents().length;
            const sibling_count = $el.siblings().length;
            const text_length = Math.min($el.text().trim().length, 1000); // Cap to prevent massive outliers
            const has_form = (tagName === 'form' || $el.closest('form').length > 0) ? 1 : 0;
            const has_href = (attribs.href !== undefined) ? 1 : 0;
            const aria_role = getRoleInt((attribs.role || '').toLowerCase());

            // 10-Dimensional Feature vector for this node
            x.push([tagInt, isClickable, isVisible, isEnabled, depth, sibling_count, text_length, has_form, has_href, aria_role]);
        });

        // 2. Second Pass: Create edges (edge_index)
        $('*').each((_, el) => {
            const parentId = nodeMap.get(el);
            if (parentId === undefined) return;

            // Connect to children
            $(el).children().each((__, child) => {
                const childId = nodeMap.get(child);
                if (childId !== undefined) {
                    // Bidirectional edge
                    // Parent -> Child
                    sourceNodes.push(parentId);
                    targetNodes.push(childId);
                    
                    // Child -> Parent
                    sourceNodes.push(childId);
                    targetNodes.push(parentId);
                }
            });
        });

        // Fallback for completely empty parses (e.g. invalid HTML)
        if (x.length === 0) {
            return { x: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]], edge_index: [[0], [0]] };
        }

        // If there are no edges, add a self-loop so GCN doesn't crash
        if (sourceNodes.length === 0) {
            sourceNodes.push(0);
            targetNodes.push(0);
        }

        return {
            x: x,
            edge_index: [sourceNodes, targetNodes]
        };
    }
}

export {  DOMToGraph  };
