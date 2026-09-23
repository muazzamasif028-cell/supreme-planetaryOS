// ============================================================
// 📝 middleware/auditLogger.middleware.js
// SUPREME Enterprise Audit Logger v11.0
// ============================================================
const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const AppError = require('./AppError');

// =============================================
// 📊 CONFIGURATION
// =============================================
const isProduction = process.env.NODE_ENV === 'production';
const LOG_DIR = path.join(process.cwd(), 'logs');
const AUDIT_LOG_FILE = path.join(LOG_DIR, 'audit.log');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'error.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// =============================================
// 🎨 SENSITIVE DATA MASKER
// =============================================
const SENSITIVE_FIELDS = [
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'apiKey',
    'creditCard',
    'cvv',
    'ssn',
    'privateKey'
];

const maskSensitiveData = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const masked = { ...obj };
    
    for (const key in masked) {
        if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
            masked[key] = '[REDACTED]';
        } else if (typeof masked[key] === 'object') {
            masked[key] = maskSensitiveData(masked[key]);
        }
    }
    
    return masked;
};

// =============================================
// 🖨️ WINSTON LOGGER SETUP
// =============================================
const auditLogger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        format.errors({ stack: true }),
        format.json()
    ),
    defaultMeta: { service: 'supreme-audit' },
    transports: [
        // Console transport (development only)
        ...(isProduction ? [] : [
            new transports.Console({
                format: format.combine(
                    format.colorize(),
                    format.printf(({ timestamp, level, message, ...meta }) => {
                        return `${timestamp} [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
                    })
                )
            })
        ]),
        
        // File transport (all environments)
        new transports.File({
            filename: AUDIT_LOG_FILE,
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 10,
            tailable: true
        })
    ]
});

// Error logger (separate file)
const errorLogger = createLogger({
    level: 'error',
    format: format.combine(
        format.timestamp(),
        format.json()
    ),
    defaultMeta: { service: 'supreme-error' },
    transports: [
        new transports.File({
            filename: ERROR_LOG_FILE,
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5
        })
    ]
});

// =============================================
// 🔍 REQUEST AUDIT MIDDLEWARE
// =============================================
const auditMiddleware = (req, res, next) => {
    // Generate unique request ID
    const requestId = require('crypto').randomUUID();
    req.id = requestId;
    
    // Record start time
    const startTime = Date.now();
    req.startTime = startTime;
    
    // Capture original end for response logging
    const originalEnd = res.end;
    let responseBody = '';
    
    // Override res.json to capture response
    const originalJson = res.json;
    res.json = function(data) {
        responseBody = data;
        return originalJson.call(this, data);
    };
    
    // Override end to log response
    res.end = function(...args) {
        const responseTime = Date.now() - startTime;
        
        // Build audit log entry
        const auditEntry = {
            requestId,
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.originalUrl,
            path: req.path,
            query: req.query,
            params: req.params,
            ip: req.ip,
            userAgent: req.get('user-agent')?.substring(0, 200) || 'unknown',
            userId: req.user?.id || 'anonymous',
            userRole: req.user?.role || 'guest',
            userEmail: req.user?.email || 'N/A',
            statusCode: res.statusCode,
            responseTime: `${responseTime}ms`,
            contentLength: res.get('content-length') || 0,
            body: maskSensitiveData(req.body),
            response: typeof responseBody === 'object' 
                ? { success: responseBody?.success } 
                : responseBody?.substring(0, 100)
        };
        
        // Log based on status code
        if (res.statusCode >= 400) {
            // Error responses
            if (res.statusCode >= 500) {
                errorLogger.error('Server Error', auditEntry);
            }
            auditLogger.warn(`${res.statusCode} ${req.method} ${req.path}`, auditEntry);
        } else {
            // Success responses
            auditLogger.info(`${res.statusCode} ${req.method} ${req.path}`, auditEntry);
        }
        
        // Performance warning for slow requests
        if (responseTime > 1000) {
            auditLogger.warn(`SLOW_REQUEST: ${responseTime}ms ${req.method} ${req.path}`, {
                requestId,
                responseTime,
                path: req.path
            });
        }
        
        return originalEnd.apply(this, args);
    };
    
    next();
};

// =============================================
// 🎯 SPECIFIC EVENT LOGGERS
// =============================================

// Log authentication events
const logAuthEvent = (event, userId, details = {}) => {
    auditLogger.info(`AUTH_EVENT: ${event}`, {
        event: 'authentication',
        action: event,
        userId,
        ...details,
        timestamp: new Date().toISOString()
    });
};

// Log data changes (CRUD operations)
const logDataChange = (action, collection, documentId, userId, changes = {}) => {
    auditLogger.info(`DATA_CHANGE: ${action} on ${collection}`, {
        event: 'data_change',
        action,
        collection,
        documentId,
        userId,
        changes: maskSensitiveData(changes),
        timestamp: new Date().toISOString()
    });
};

// Log security events
const logSecurityEvent = (event, severity = 'medium', details = {}) => {
    const logMethod = severity === 'high' ? 'error' : 'warn';
    auditLogger[logMethod](`SECURITY: ${event}`, {
        event: 'security',
        action: event,
        severity,
        ...details,
        timestamp: new Date().toISOString()
    });
};

// Log API key usage
const logAPIKeyUsage = (apiKey, endpoint, userId) => {
    auditLogger.info(`API_KEY_USED: ${endpoint}`, {
        event: 'api_key_usage',
        apiKey: apiKey.substring(0, 8) + '...', // Only log prefix
        endpoint,
        userId,
        timestamp: new Date().toISOString()
    });
};

// Log billing events
const logBillingEvent = (event, userId, amount, details = {}) => {
    auditLogger.info(`BILLING: ${event}`, {
        event: 'billing',
        action: event,
        userId,
        amount,
        currency: 'USD',
        ...details,
        timestamp: new Date().toISOString()
    });
};

// =============================================
// 📊 AUDIT QUERY HELPER
// =============================================
const queryAuditLogs = async (filters = {}) => {
    // For production, this would query Elasticsearch or a database
    // For now, returns basic structure
    return {
        message: 'Audit log query is available in production with Elasticsearch integration',
        filters,
        timestamp: new Date().toISOString()
    };
};

// =============================================
// 🧹 LOG CLEANUP SCHEDULER
// =============================================
const cleanupOldLogs = () => {
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    [AUDIT_LOG_FILE, ERROR_LOG_FILE].forEach(logFile => {
        if (fs.existsSync(logFile)) {
            const stats = fs.statSync(logFile);
            const fileAge = Date.now() - stats.mtimeMs;
            
            if (fileAge > maxAge) {
                // Archive old log
                const archiveDir = path.join(LOG_DIR, 'archive');
                if (!fs.existsSync(archiveDir)) {
                    fs.mkdirSync(archiveDir, { recursive: true });
                }
                
                const archiveName = `${path.basename(logFile)}.${new Date().toISOString().split('T')[0]}`;
                fs.renameSync(logFile, path.join(archiveDir, archiveName));
            }
        }
    });
};

// Run cleanup every 24 hours
setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);

// =============================================
// 🤫 EXPORT
// =============================================
module.exports = auditMiddleware;
module.exports.logAuthEvent = logAuthEvent;
module.exports.logDataChange = logDataChange;
module.exports.logSecurityEvent = logSecurityEvent;
module.exports.logAPIKeyUsage = logAPIKeyUsage;
module.exports.logBillingEvent = logBillingEvent;
module.exports.queryAuditLogs = queryAuditLogs;
module.exports.auditLogger = auditLogger;
module.exports.errorLogger = errorLogger;
