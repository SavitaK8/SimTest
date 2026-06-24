import {  StateGraph  } from '../src/state-graph';

describe('StateGraph', () => {
    let graph;

    beforeEach(() => {
        graph = new StateGraph();
    });

    test('should add states and transitions correctly', () => {
        graph.addState('hash1', { url: '/a' });
        graph.addState('hash2', { url: '/b' });
        
        graph.addTransition('hash1', 'hash2', { type: 'click', selector: 'btn' });
        
        const path = graph.getPath('hash1', 'hash2');
        expect(path).toHaveLength(2);
        expect(path[1].action).toEqual({ type: 'click', selector: 'btn' });
    });

    test('should find the shortest path over multiple nodes', () => {
        graph.addState('1', { url: '/1' });
        graph.addState('2', { url: '/2' });
        graph.addState('3', { url: '/3' });
        
        graph.addTransition('1', '2', { type: 'click', selector: 'A' });
        graph.addTransition('2', '3', { type: 'click', selector: 'B' });
        
        // Add a slower circular path
        graph.addTransition('1', '3', { type: 'click', selector: 'C' });
        
        // Dijkstra should prefer the direct 1->3 edge
        const path = graph.getPath('1', '3');
        expect(path).toHaveLength(2);
        expect(path[1].action.selector).toBe('C');
    });

    test('should return null if no path exists', () => {
        graph.addState('1', {});
        graph.addState('2', {});
        
        expect(graph.getPath('1', '2')).toBeNull();
    });
});
