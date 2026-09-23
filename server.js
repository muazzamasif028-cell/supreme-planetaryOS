'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');

require('dotenv').config();

const registry = require('./integration/registry');
const orchestrator = require('./integration/orchestrator');
const { registerCoreModules } = require('./integration/register-core');

// SUPREME Frontend + Backend HyperScale Runtime
const supremeScale = require('./supreme-scale');

const organizationRoutes =
    require('./organizations/organization-routes');

const memberRoutes =
    require('./organizations/members/member-routes');

const domainRoutes = require('./domain.routes');
const enterpriseAccess = require('./security/enterprise-access');
const { authenticateToken, createToken } = require('./security/auth/jwt-auth');

const {
    requireOrganization
} = require('./security/organizations/require-organization');

const {
    requireOrganizationMember
} = require('./organizations/security/require-organization-member');

const {
    PERMISSIONS
} = require('./security/rbac/permissions');

const {
    requirePermission
} = require('./security/rbac/require-permission');

const app = express();

const neomRealtimeTelemetry = require('./neom-telemetry/NeomRealtimeTelemetry');
const telemetryMetrics = require('./neom-telemetry/observability/TelemetryMetrics');
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: process.env.ALLOWED_ORIGINS
            ? process.env.ALLOWED_ORIGINS.split(',').map(value => value.trim())
            : '*'
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

neomRealtimeTelemetry.attachSocketServer(io);
const PORT = process.env.PORT || 5000;

let server = null;
let shuttingDown = false;

// ============================================
// Core Integration
// ============================================

registerCoreModules();

// ============================================
// Middleware
// ============================================

app.use(helmet());
app.use(cors());
app.use(compression());

app.use(express.json({
    limit: '10mb'
}));

app.use(
    '/api/organizations',
    organizationRoutes
);

app.use(
    '/api/organization-members',
    memberRoutes
);

app.use(
    '/api/domain',
    domainRoutes
);

// ============================================
// Root
// ============================================

app.get('/', (req, res) => {
    res.json({
        name: 'SUPREME Platform',
        version: '14.0.0',
        status: 'RUNNING',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),

        scale: supremeScale.status()
    });
});

// ============================================
// Health
// ============================================

app.get('/api/health', (req, res) => {
    const modules = registry.list();

    res.json({
        status: 'HEALTHY',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),

        integration: {
            modules: {
                total: modules.length,
                enabled: modules.filter(
                    module => module.enabled
                ).length,
                disabled: modules.filter(
                    module => !module.enabled
                ).length
            },

            orchestrator: orchestrator.status()
        },

        hyperscale: supremeScale.status()
    });
});

// ============================================
// Dashboard
// ============================================

app.get('/api/dashboard', (req, res) => {

    const organization =
        enterpriseAccess.getOrganization(req);

    const enterpriseFeatures =
        enterpriseAccess.getAvailableFeatures(
            organization
        );

    res.json({
        dashboard: 'SUPREME PLATFORM',
        version: '14.0.0',
        status: 'OPERATIONAL',

        organization: organization || 'PUBLIC',

        modules: [
            'Problem Detector',
            'AI Engine',
            'Payment Gateway',
            'Domain Engine',
            'Satellite Layer',
            'Fleet Management',
            'Security Engine',
            'SUPREME Scale Runtime',
            'Backend HyperScale Runtime'
        ],

        enterpriseFeatures,

        integration: {
            registeredModules: registry.count(),
            orchestrator: orchestrator.status()
        },

        hyperscale: supremeScale.status()
    });
});

// ============================================
// ============================================
// Development Authentication — LOCAL TESTING ONLY
// ============================================

app.post('/api/auth/dev-token', (req, res) => {

    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({
            error: 'ENDPOINT_NOT_AVAILABLE'
        });
    }

    const {
        userId = 'development-user',
        organization,
        role = 'USER'
    } = req.body || {};

    if (!organization) {
        return res.status(400).json({
            error: 'ORGANIZATION_REQUIRED'
        });
    }

    const token = createToken({
        userId,
        organization,
        role
    });

    res.json({
        tokenType: 'Bearer',
        organization: organization.toUpperCase(),
        role,
        expiresIn:
            process.env.JWT_EXPIRES_IN || '1h',
        token
    });
});

// ============================================

// Integration Status
// ============================================

app.get('/api/integration', (req, res) => {
    res.json({
        status: 'ACTIVE',

        orchestrator: orchestrator.status(),

        modules: registry.list(),

        hyperscale: supremeScale.status()
    });
});

// ============================================
// NEOM Command Center — Restricted
// ============================================

app.get(
    '/api/enterprise/neom',
    authenticateToken,

    requireOrganization,

    enterpriseAccess.requireFeature(
        'NEOM_COMMAND_CENTER'
    ),

    requirePermission(
        PERMISSIONS.NEOM_VIEW
    ),

    (req, res) => {

        res.json({
            organization: 'NEOM',
            feature: 'NEOM Command Center',
            status: 'AUTHORIZED',

            systems: [
                'Renewable Energy Management',
                'Green Hydrogen Monitoring',
                'THE LINE Infrastructure',
                'OXAGON Operations',
                'BESS Energy Storage',
                'Carbon Intelligence'
            ],

            timestamp:
                new Date().toISOString()
        });

    }
);

// ============================================
// SpaceX Mission Control — Restricted
// ============================================

app.get(
    '/api/enterprise/spacex',
    authenticateToken,

    requireOrganization,

    enterpriseAccess.requireFeature(
        'SPACEX_MISSION_CONTROL'
    ),

    requirePermission(
        PERMISSIONS.SPACEX_VIEW
    ),

    (req, res) => {

        res.json({
            organization: 'SpaceX',
            feature: 'SpaceX Mission Control',
            status: 'AUTHORIZED',

            systems: [
                'Mission Operations',
                'Launch Monitoring',
                'Fleet Telemetry',
                'Satellite Operations',
                'Engineering Intelligence',
                'Autonomous Systems'
            ],

            timestamp:
                new Date().toISOString()
        });

    }
);

// ============================================

// ============================================
// SUPREME SCALE STATUS
// ============================================

app.get('/api/scale', (req, res) => {
    res.json({
        status: supremeScale.status().started
            ? 'ONLINE'
            : 'OFFLINE',

        runtime: supremeScale.status(),

        timestamp: new Date().toISOString()
    });
});

// ============================================
// Problem Detection
// ============================================

app.post('/api/detect', (req, res, next) => {
    try {
        const detector = registry.get('problem-detector');

        if (!detector) {
            return res.status(503).json({
                error: 'DETECTION_SERVICE_UNAVAILABLE'
            });
        }

        const result = detector.detect(req.body?.input);

        return res.status(200).json(result);

    } catch (error) {
        return next(error);
    }
});


// ============================================
// NEOM Real-Time Telemetry
// ============================================

app.post(
    '/api/neom/telemetry',
    authenticateToken,
    requireOrganization,
    requirePermission(
        PERMISSIONS.NEOM_VIEW
    ),
    async (req, res, next) => {
        try {
            const telemetry =
                await neomRealtimeTelemetry.ingest(
                    req.body,
                    req.auth
                );

            return res.status(201).json({
                status: 'TELEMETRY_INGESTED',
                telemetry
            });
        } catch (error) {
            return next(error);
        }
    }
);

app.get(
    '/api/neom/telemetry/status',
    authenticateToken,
    requireOrganization,
    requirePermission(
        PERMISSIONS.NEOM_VIEW
    ),
    (req, res) => {
        res.json(
            neomRealtimeTelemetry.status()
        );
    }
);

app.get(
    '/api/neom/telemetry/history',
    authenticateToken,
    requireOrganization,
    requirePermission(
        PERMISSIONS.NEOM_VIEW
    ),
    (req, res) => {
        res.json({
            events:
                neomRealtimeTelemetry.getHistory({
                    zone: req.query.zone,
                    domain: req.query.domain,
                    assetId: req.query.assetId,
                    limit: req.query.limit
                })
        });
    }
);

// ============================================
// NEOM System Telemetry
// ============================================

app.get(
    '/api/neom/telemetry/system',
    authenticateToken,
    requireOrganization,
    requirePermission(
        PERMISSIONS.NEOM_VIEW
    ),
    (req, res) => {
        res.json(
            neomRealtimeTelemetry.systemTelemetry()
        );
    }
);

// ============================================
// ============================================
// Prometheus Metrics
// ============================================
app.get("/metrics", async (req, res, next) => {
    try {
        const metrics = await telemetryMetrics.metrics();
        res.set("Content-Type", telemetryMetrics.contentType());
        return res.status(200).send(metrics);
    } catch (error) {
        return next(error);
    }
});

// 404
// ============================================

app.use((req, res) => {
    res.status(404).json({
        error: 'ENDPOINT_NOT_FOUND',
        path: req.path
    });
});

// ============================================
// Error Handler
// ============================================

app.use((err, req, res, next) => {
    console.error('[SUPREME Server Error]', err.message);

    res.status(err instanceof TypeError ? 400 : 500).json({
        error: err instanceof TypeError ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR',
        message: err.message
    });
});

// ============================================
// Start Server
// ============================================

function startServer() {

    if (server) {
        return server;
    }

    orchestrator.start();

    supremeScale.start();
neomRealtimeTelemetry.startAdapters();

    server = httpServer.listen(PORT, () => {

        console.log('');
        console.log('========================================');
        console.log('SUPREME Platform v14.0.0 RUNNING');
        console.log('========================================');

        console.log(
            'Port: http://localhost:' + PORT
        );

        console.log(
            'Health: http://localhost:' +
            PORT +
            '/api/health'
        );

        console.log(
            'Dashboard: http://localhost:' +
            PORT +
            '/api/dashboard'
        );

        console.log(
            'Integration: http://localhost:' +
            PORT +
            '/api/integration'
        );

        console.log(
            'Scale Runtime: http://localhost:' +
            PORT +
            '/api/scale'
        );

        console.log(
            'Detection API: POST http://localhost:' +
            PORT +
            '/api/detect'
        );

        console.log('========================================');
    });

    server.on('error', (error) => {
        console.error(
            '[SUPREME Server Startup Error]',
            error.message
        );

        if (error.code === 'EADDRINUSE') {
            console.error(
                'Port ' + PORT + ' is already in use.'
            );
        }
    });

    return server;
}

// ============================================
// Graceful Shutdown
// ============================================

function shutdown(signal) {

    if (shuttingDown) {
        return;
    }

    shuttingDown = true;

    console.log('');
    console.log(
        '[SUPREME] ' +
        signal +
        ' received. Shutting down...'
    );

    try {
        orchestrator.stop();
    } catch (error) {
        console.error(
            '[Integration Shutdown Error]',
            error.message
        );
    }

    try {
        supremeScale.stop();
    } catch (error) {
        console.error(
            '[Scale Shutdown Error]',
            error.message
        );
    }

    if (!server) {
        process.exit(0);
        return;
    }

    server.close(() => {

        console.log(
            '[SUPREME] Server shutdown complete'
        );

        process.exit(0);
    });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ============================================
// Start Application
// ============================================

if (require.main === module) {
    startServer();
}

// ============================================
// Exports
// ============================================

module.exports = {
    app,
    startServer,
    shutdown
};
