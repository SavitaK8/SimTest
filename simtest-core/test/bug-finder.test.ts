import {  BugFinder  } from '../src/bug-finder';

describe('BugFinder', () => {
    let bugFinder;

    beforeEach(() => {
        bugFinder = new BugFinder();
    });

    test('should detect JavaScript crashes via console errors', () => {
        const state = {
            url: 'http://localhost/test',
            consoleErrors: ['[pageerror] TypeError: Cannot read properties of null'],
            interactiveElements: [{ enabled: true, visible: true }]
        };
        const action = { type: 'click', selector: 'button' };
        
        bugFinder.analyze(state, null, action);
        const bugs = bugFinder.getBugs();
        
        expect(bugs).toHaveLength(1);
        expect(bugs[0].type).toBe('js_crash');
        expect(bugs[0].score).toBe(5);
    });

    test('should detect network errors via HTTP status codes', () => {
        const state = {
            url: 'http://localhost/api/data',
            networkErrors: [{ status: 500, url: 'http://localhost/api/data' }],
            interactiveElements: [{ enabled: true, visible: true }]
        };
        
        bugFinder.analyze(state, null, null);
        const bugs = bugFinder.getBugs();
        
        expect(bugs).toHaveLength(1);
        expect(bugs[0].type).toBe('network_error');
        expect(bugs[0].score).toBe(5);
    });

    test('should detect NaN or undefined strings in the UI', () => {
        const state = {
            url: 'http://localhost/cart',
            bodyText: 'Total price: $NaN. Your cart has undefined items.',
            interactiveElements: [{ enabled: true, visible: true }]
        };
        
        bugFinder.analyze(state, null, null);
        const bugs = bugFinder.getBugs();
        
        expect(bugs).toHaveLength(1);
        expect(bugs[0].type).toBe('nan_in_ui');
        expect(bugs[0].score).toBe(2);
    });

    test('should detect unprotected routes containing sensitive keywords', () => {
        const state = {
            url: 'http://localhost/admin/dashboard',
            bodyText: 'User! Here is your private data.',
            interactiveElements: [{ enabled: true, visible: true }]
        };
        
        bugFinder.analyze(state, null, null);
        const bugs = bugFinder.getBugs();
        
        expect(bugs).toHaveLength(1);
        expect(bugs[0].type).toBe('unprotected_route');
        expect(bugs[0].score).toBe(10);
    });

    test('should detect dead ends (no interactive elements)', () => {
        const state = {
            url: 'http://localhost/error',
            elements: [] // No links or buttons
        };
        const prevState = { url: 'http://localhost/' };
        
        bugFinder.analyze(state, prevState, null);
        const bugs = bugFinder.getBugs();
        
        expect(bugs).toHaveLength(1);
        expect(bugs[0].type).toBe('dead_end');
        expect(bugs[0].score).toBe(2);
    });
});
