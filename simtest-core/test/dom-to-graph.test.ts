import {  DOMToGraph  } from '../src/dom-to-graph';

describe('DOMToGraph Parser', () => {
    test('should parse empty HTML to fallback graph', () => {
        const graph = DOMToGraph.parse('');
        expect(graph.x).toHaveLength(1);
        expect(graph.x[0]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        expect(graph.edge_index).toEqual([[0], [0]]);
    });

    test('should extract 10-dimensional node features correctly', () => {
        const html = `
            <div>
                <button role="button">Click Me</button>
                <a href="/login" class="nav-link">Login</a>
                <form>
                    <input type="text" disabled />
                </form>
            </div>
        `;
        const graph = DOMToGraph.parse(html);
        
        // Node 0: div, Node 1: button, Node 2: a, Node 3: form, Node 4: input
        expect(graph.x.length).toBeGreaterThan(0);
        
        // Find the button node
        const btnNode = graph.x.find(node => node[0] === 1); // tag: button=1
        expect(btnNode).toBeDefined();
        expect(btnNode[1]).toBe(1); // clickable
        expect(btnNode[4]).toBe(3); // depth (html -> body -> div -> button)
        expect(btnNode[6]).toBe(8); // text_length ("Click Me")
        expect(btnNode[9]).toBe(1); // aria_role: button=1

        // Find the a node
        const aNode = graph.x.find(node => node[0] === 2); // tag: a=2
        expect(aNode).toBeDefined();
        expect(aNode[1]).toBe(1); // clickable
        expect(aNode[8]).toBe(1); // has_href
        
        // Find the input node
        const inputNode = graph.x.find(node => node[0] === 3); // tag: input=3
        expect(inputNode).toBeDefined();
        expect(inputNode[3]).toBe(0); // enabled=0 (disabled)
    });

    test('should build correct edge_index', () => {
        const html = `<div><span>text</span></div>`;
        const graph = DOMToGraph.parse(html);
        
        // div (0) -> span (1)
        expect(graph.edge_index[0]).toContain(0);
        expect(graph.edge_index[1]).toContain(1);
    });
});
