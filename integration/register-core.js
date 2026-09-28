'use strict';

/**
 * SUPREME Integration Registry
 *
 * Central registration point for executable core modules.
 */

const registry = require('./registry');

const detector = require('../problem-detector');
const RootCauseEngine = require('../root-cause.js — COMPLETE');
const SolutionEngine = require('../solution-engine.js — COMPLETE');

function registerCoreModules() {

    // ============================================
    // PROBLEM DETECTOR
    // ============================================

    if (!registry.has('problem-detector')) {
        registry.register('problem-detector', detector, {
            version: '1.0.0',
            category: 'ai-detection',
            dependencies: []
        });
    }

    // ============================================
    // ROOT CAUSE ENGINE
    // ============================================

    if (!registry.has('root-cause-engine')) {
        const rootCauseEngine = new RootCauseEngine();

        registry.register('root-cause-engine', rootCauseEngine, {
            version: '1.0.0',
            category: 'ai-analysis',
            dependencies: ['problem-detector']
        });
    }

    // ============================================
    // SOLUTION ENGINE
    // ============================================

    if (!registry.has('solution-engine')) {
        const solutionEngine = new SolutionEngine();

        registry.register('solution-engine', solutionEngine, {
            version: '1.0.0',
            category: 'ai-solution',
            dependencies: ['root-cause-engine']
        });
    }

    return registry.list();
}

module.exports = {
    registerCoreModules
};
