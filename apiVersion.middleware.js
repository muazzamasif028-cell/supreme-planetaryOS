// ============================================================
// 📌 middleware/apiVersion.middleware.js
// SUPREME API Versioning Middleware v11.0
// ============================================================
const AppError = require('./AppError');

// =============================================
// 📊 VERSION CONFIGURATION
// =============================================
const SUPPORTED_VERSIONS = ['v1', 'v2'];
const DEFAULT_VERSION = 'v2';
const DEPRECATED_VERSIONS = ['v1'];
const MINIMUM_CLIENT_VERSION = '1.0.0';
const CURRENT_API_VERSION = '2.0.0';

// Version deprecation dates
const DEPRECATION_DATES = {
    v1: '2025-12-31' // v1 will be removed after this date
};

// =============================================
// 🔍 VERSION PARSER
// =============================================
const parseVersion = (req) => {
    // Check multiple sources for version info
    const sources = [
        req.headers['x-api-version'],           // Custom header
        req.headers['accept-version'],          // Standard header
        req.query.version,                      // Query parameter
        req.path.split('/')[1]?.startsWith('v') ? req.path.split('/')[1] : null, // URL path
        req.headers['accept']?.includes('version=') 
            ? req.headers['accept'].match(/version=([^,;]+)/)?.[1] 
            : null                              // Accept header
    ];
    
    // Return first valid version found
    for (const version of sources) {
        if (version && SUPPORTED_VERSIONS.includes(version.toLowerCase())) {
            return version.toLowerCase();
        }
    }
    
    return DEFAULT_VERSION;
};

// =============================================
// 🎯 VERSION MIDDLEWARE
// =============================================
const apiVersionMiddleware = (req, res, next) => {
    const requestedVersion = parseVersion(req);
    
    // Set version info on request
    req.apiVersion = requestedVersion;
    
    // Set response headers
    res.set('X-API-Version', CURRENT_API_VERSION);
    res.set('X-Requested-Version', requestedVersion);
    res.set('X-Deprecated-Versions', DEPRECATED_VERSIONS.join(', '));
    
    // Check if version is deprecated
    if (DEPRECATED_VERSIONS.includes(requestedVersion)) {
        const deprecationDate = DEPRECATION_DATES[requestedVersion];
        const isExpired = deprecationDate && new Date(deprecationDate) < new Date();
        
        if (isExpired) {
            // Version expired - return 410 Gone
            return res.status(410).json({
                success: false,
                error: {
                    code: 'VERSION_EXPIRED',
                    message: `API ${requestedVersion} is no longer available. Please upgrade to ${DEFAULT_VERSION}.`,
                    currentVersion: CURRENT_API_VERSION,
                    migrationGuide: '/docs/migration'
                }
            });
        }
        
        // Version deprecated but still active - add warning header
        res.set('X-Deprecation-Warning', `Version ${requestedVersion} is deprecated and will be removed on ${deprecationDate}. Please migrate to ${DEFAULT_VERSION}.`);
        res.set('X-Sunset-Date', deprecationDate);
        res.set('Warning', `299 - "API version ${requestedVersion} is deprecated"`);
    }
    
    // Check minimum client version
    const clientVersion = req.headers['x-client-version'];
    if (clientVersion && clientVersion < MINIMUM_CLIENT_VERSION) {
        return res.status(426).json({
            success: false,
            error: {
                code: 'UPGRADE_REQUIRED',
                message: `Client version ${clientVersion} is too old. Minimum required: ${MINIMUM_CLIENT_VERSION}.`,
                upgradeUrl: 'https://supreme-os.com/upgrade'
            }
        });
    }
    
    next();
};

// =============================================
// 📦 VERSION-SPECIFIC ROUTE HANDLER
// =============================================
// Usage: router.get('/users', versionHandler({ v1: v1Controller, v2: v2Controller }))
const versionHandler = (handlers) => {
    return (req, res, next) => {
        const version = req.apiVersion || DEFAULT_VERSION;
        const handler = handlers[version] || handlers[DEFAULT_VERSION];
        
        if (!handler) {
            return next(new AppError(`No handler for version ${version}`, 500));
        }
        
        return handler(req, res, next);
    };
};

// =============================================
// 🤫 EXPORT
// =============================================
module.exports = apiVersionMiddleware;
module.exports.versionHandler = versionHandler;
module.exports.SUPPORTED_VERSIONS = SUPPORTED_VERSIONS;
module.exports.DEFAULT_VERSION = DEFAULT_VERSION;
module.exports.CURRENT_API_VERSION = CURRENT_API_VERSION;
