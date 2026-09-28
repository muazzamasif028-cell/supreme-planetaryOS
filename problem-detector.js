'use strict';

/**
 * SUPREME AI Problem Detector
 *
 * Detects and classifies technical problems.
 */

class ProblemDetector {
    constructor() {
        this.initialized = false;
        this.detections = 0;
    }

    initialize() {
        this.initialized = true;
        console.log('Problem Detector initialized');
    }

    shutdown() {
        this.initialized = false;
        console.log('Problem Detector shutdown');
    }

    analyze(input) {
        const text = input.toLowerCase();

        const rules = [

            // ============================================
            // PERFORMANCE / CPU
            // ============================================

            {
                category: 'PERFORMANCE',
                type: 'cpu-problem',
                symptom: 'high_cpu_usage',
                severity: 'HIGH',
                confidence: 0.95,
                keywords: [
                    'cpu',
                    'high cpu',
                    'cpu usage',
                    'processor usage',
                    'processor overload',
                    'cpu overload'
                ],
                possibleCauses: [
                    'CPU-intensive process',
                    'Infinite loop or runaway process',
                    'Unexpected traffic or workload'
                ],
                recommendedActions: [
                    'Check CPU utilization',
                    'Identify high-CPU processes',
                    'Inspect application and system logs'
                ]
            },

            // ============================================
            // MEMORY
            // ============================================

            {
                category: 'RESOURCE',
                type: 'memory-problem',
                symptom: 'memory_leak',
                severity: 'HIGH',
                confidence: 0.94,
                keywords: [
                    'memory leak',
                    'memory usage',
                    'high memory',
                    'ram usage',
                    'ram full',
                    'out of memory',
                    'oom',
                    'heap'
                ],
                possibleCauses: [
                    'Memory leak',
                    'Insufficient available memory',
                    'Unbounded application memory usage'
                ],
                recommendedActions: [
                    'Check memory and RAM utilization',
                    'Inspect heap usage',
                    'Identify processes consuming excessive memory'
                ]
            },

            // ============================================
            // DISK / STORAGE
            // ============================================

            {
                category: 'RESOURCE',
                type: 'disk-problem',
                symptom: 'disk_full',
                severity: 'HIGH',
                confidence: 0.91,
                keywords: [
                    'disk full',
                    'disk is full',
                    'full disk',
                    'disk space',
                    'low disk space',
                    'no disk space',
                    'storage full',
                    'storage',
                    'disk error',
                    'disk failure',
                    'data loss',
                    'corrupt data',
                    'corrupted data'
                ],
                possibleCauses: [
                    'Insufficient disk space',
                    'Storage failure',
                    'Data corruption or deletion'
                ],
                recommendedActions: [
                    'Check disk utilization',
                    'Inspect storage health',
                    'Check filesystem and application logs'
                ]
            },

            // ============================================
            // RESPONSE / LATENCY
            // ============================================

            {
                category: 'PERFORMANCE',
                type: 'performance-problem',
                symptom: 'slow_response',
                severity: 'MEDIUM',
                confidence: 0.88,
                keywords: [
                    'slow',
                    'slow response',
                    'slow server',
                    'slow application',
                    'latency',
                    'lag',
                    'delay',
                    'performance degraded',
                    'performance degradation'
                ],
                possibleCauses: [
                    'High system load',
                    'Database or network latency',
                    'Resource contention'
                ],
                recommendedActions: [
                    'Check CPU and memory utilization',
                    'Check database response time',
                    'Check network latency and system logs'
                ]
            },

            // ============================================
            // DATABASE
            // ============================================

            {
                category: 'DATABASE',
                type: 'database-problem',
                symptom: 'database_issue',
                severity: 'HIGH',
                confidence: 0.95,
                keywords: [
                    'database',
                    'sql',
                    'mongodb',
                    'postgres',
                    'mysql',
                    'connection failed'
                ],
                possibleCauses: [
                    'Database server is unavailable',
                    'Invalid database credentials',
                    'Incorrect connection configuration'
                ],
                recommendedActions: [
                    'Check database server status',
                    'Verify database credentials',
                    'Check connection configuration'
                ]
            },

            // ============================================
            // AUTHENTICATION
            // ============================================

            {
                category: 'AUTHENTICATION',
                type: 'authentication-problem',
                symptom: 'unauthorized_access',
                severity: 'HIGH',
                confidence: 0.94,
                keywords: [
                    'unauthorized',
                    'authentication',
                    'token',
                    'jwt',
                    'login failed',
                    'access denied'
                ],
                possibleCauses: [
                    'Invalid authentication token',
                    'Expired token',
                    'Invalid credentials'
                ],
                recommendedActions: [
                    'Check authentication token',
                    'Verify token expiration',
                    'Check authentication middleware'
                ]
            },

            // ============================================
            // APPLICATION
            // ============================================

            {
                category: 'APPLICATION',
                type: 'application-problem',
                severity: 'CRITICAL',
                confidence: 0.92,
                keywords: [
                    'crashing',
                    'crash',
                    'not working',
                    'runtime error',
                    'application stopped'
                ],
                possibleCauses: [
                    'Unhandled application error',
                    'Runtime exception',
                    'Missing dependency'
                ],
                recommendedActions: [
                    'Check application logs',
                    'Inspect the error stack trace',
                    'Verify installed dependencies'
                ]
            },

            // ============================================
            // NETWORK
            // ============================================

            {
                category: 'NETWORK',
                type: 'network-timeout',
                symptom: 'timeout',
                severity: 'HIGH',
                confidence: 0.91,
                keywords: [
                    'timeout',
                    'timed out',
                    'request timeout',
                    'network timeout'
                ],
                possibleCauses: [
                    'Service response timeout',
                    'Network latency or packet loss',
                    'Routing problem'
                ],
                recommendedActions: [
                    'Check network latency',
                    'Check service response time',
                    'Inspect routing and network logs'
                ]
            },
            {
                category: 'NETWORK',
                type: 'network-connection-problem',
                symptom: 'connection_refused',
                severity: 'HIGH',
                confidence: 0.91,
                keywords: [
                    'connection refused',
                    'connection was refused',
                    'connection reset',
                    'connection failed',
                    'disconnect',
                    'disconnected'
                ],
                possibleCauses: [
                    'Service unavailable',
                    'Firewall or port problem',
                    'DNS or routing failure'
                ],
                recommendedActions: [
                    'Check service availability',
                    'Verify ports and firewall rules',
                    'Check DNS and network connectivity'
                ]
            },
            {
                category: 'NETWORK',
                type: 'network-problem',
                symptom: 'connection_refused',
                severity: 'HIGH',
                confidence: 0.91,
                keywords: [
                    'network',
                    'dns',
                    'network error'
                ],
                possibleCauses: [
                    'Network connectivity problem',
                    'Service unavailable',
                    'Firewall or port problem'
                ],
                recommendedActions: [
                    'Check network connectivity',
                    'Check service availability',
                    'Verify ports and firewall rules'
                ]
            }
        ];

        for (const rule of rules) {
            const matchedKeywords = rule.keywords.filter(keyword =>
                text.includes(keyword)
            );

            if (matchedKeywords.length > 0) {
                return {
                    ...rule,
                    matchedKeywords
                };
            }
        }

        return {
            category: 'GENERAL',
            type: 'unknown-problem',
            symptom: 'unknown',
            severity: 'MEDIUM',
            confidence: 0.60,
            keywords: [],
            matchedKeywords: [],
            possibleCauses: [
                'Insufficient information available'
            ],
            recommendedActions: [
                'Provide more details about the problem',
                'Check system logs'
            ]
        };
    }

    detect(input) {
        if (!this.initialized) {
            throw new Error('Problem Detector is not initialized');
        }

        if (input === undefined || input === null) {
            throw new TypeError('Detection input is required');
        }

        const value = typeof input === 'string'
            ? input.trim()
            : JSON.stringify(input);

        if (!value) {
            throw new TypeError('Detection input cannot be empty');
        }

        this.detections += 1;

        const analysis = this.analyze(value);

        return {
            detected: analysis.type !== 'unknown-problem',
            type: analysis.type,
            category: analysis.category,
            symptom: analysis.symptom || 'unknown',
            severity: analysis.severity,
            confidence: analysis.confidence,
            input: value,
            matchedKeywords: analysis.matchedKeywords,
            possibleCauses: analysis.possibleCauses,
            recommendedActions: analysis.recommendedActions,
            detectionId: `DET-${this.detections}`,
            timestamp: new Date().toISOString()
        };
    }

    status() {
        return {
            initialized: this.initialized,
            detections: this.detections
        };
    }
}

module.exports = new ProblemDetector();
