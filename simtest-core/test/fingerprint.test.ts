import {  computeFingerprint  } from '../src/fingerprint';

describe('State Fingerprinting', () => {
    test('should generate identical hashes for identical states', () => {
        const state1 = {
            url: 'http://localhost/',
            elements: [{ text: 'Login' }, { text: 'Signup' }]
        };
        const state2 = {
            url: 'http://localhost/',
            elements: [{ text: 'Login' }, { text: 'Signup' }]
        };
        
        expect(computeFingerprint(state1)).toEqual(computeFingerprint(state2));
    });

    test('should generate different hashes for different URLs', () => {
        const state1 = {
            url: 'http://localhost/home',
            elements: []
        };
        const state2 = {
            url: 'http://localhost/about',
            elements: []
        };
        
        expect(computeFingerprint(state1)).not.toEqual(computeFingerprint(state2));
    });

    test('should generate different hashes for different DOM structures', () => {
        const state1 = {
            url: 'http://localhost/',
            interactiveElements: [{ tag: 'button', id: 'login-btn' }]
        };
        const state2 = {
            url: 'http://localhost/',
            interactiveElements: [{ tag: 'button', id: 'logout-btn' }]
        };
        
        expect(computeFingerprint(state1)).not.toEqual(computeFingerprint(state2));
    });
});
