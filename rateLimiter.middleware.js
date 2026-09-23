// ============================================================
// 🛡️ middleware/rateLimiter.middleware.js
// SUPREME Enterprise Rate Limiter v11.0
// ============================================================
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const RedisStore = require('rate-limit-redis'); // Production ke liye
const AppError = require('./AppError');

// =============================================
// 📊 CONFIGURATION
// =============================================
const isProduction = process.env.NODE_ENV === 'production';

// Redis client (fallback to memory in development)
let store;
if (isProduction && process.env.REDIS_URL) {
    const Redis = require('ioredis');
    const client = new Redis(process.env.REDIS_URL);
    store = new RedisStore({
        sendCommand: (...args) => client.call(...args),
        prefix: 'supreme_ratelimit:'
    });
}

// =============================================
// 🔐 AUTH RATE LIMITER (Strict - 10 req/15 min)
// =============================================
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many authentication attempts. Please try again after 15 minutes.',
            retryAfter: '15 minutes'
        }
    },
    keyGenerator: (req) => {
        // Use IP + email combination for better tracking
        const email = req.body?.email || 'unknown';
        return `${ipKeyGenerator(req.ip)}_auth_${email}`;
    },
    skip: (req) => {
        // Skip rate limiting for internal services
        return req.headers['x-internal-service'] === process.env.INTERNAL_API_KEY;
    },
    handler: (req, res, next, options) => {
        res.status(429).json(options.message);
    },
    ...(store && { store })
});

// =============================================
// ⚡ GENERAL API RATE LIMITER (100 req/min)
// =============================================
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'API_RATE_LIMIT',
            message: 'API rate limit exceeded. Please slow down.',
            retryAfter: '1 minute'
        }
    },
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise IP
        return req.user?.id || ipKeyGenerator(req.ip);
    },
    skip: (req) => {
        // Admin users get higher limits
        return req.user?.role === 'admin';
    },
    ...(store && { store })
});

// =============================================
// 🤖 LLM RATE LIMITER (30 req/min - Expensive)
// =============================================
const llmLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'LLM_RATE_LIMIT',
            message: 'AI model rate limit exceeded. Please wait before making more requests.',
            retryAfter: '1 minute',
            tip: 'Consider upgrading your plan for higher limits.'
        }
    },
    keyGenerator: (req) => {
        // Track per user + per model
        const model = req.body?.model || 'default';
        return `${req.user?.id || ipKeyGenerator(req.ip)}_llm_${model}`;
    },
    skip: (req) => {
        // Premium users get higher limits
        return req.user?.tier === 'enterprise';
    },
    ...(store && { store })
});

// =============================================
// 📡 TELEMETRY RATE LIMITER (1000 req/min)
// =============================================
const telemetryLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'TELEMETRY_RATE_LIMIT',
            message: 'Telemetry data rate limit exceeded.'
        }
    },
    ...(store && { store })
});

// =============================================
// 💳 PAYMENT RATE LIMITER (5 req/min - Critical)
// =============================================
const paymentLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'PAYMENT_RATE_LIMIT',
            message: 'Payment processing rate limit exceeded. For security, please wait.'
        }
    },
    keyGenerator: (req) => {
        return `${req.user?.id || ipKeyGenerator(req.ip)}_payment`;
    },
    ...(store && { store })
});

// =============================================
// 🌐 PUBLIC RATE LIMITER (1000 req/min)
// =============================================
const publicLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'PUBLIC_RATE_LIMIT',
            message: 'Too many requests from this IP.'
        }
    },
    ...(store && { store })
});

// =============================================
// 🎯 DYNAMIC RATE LIMITER (Custom limits)
// =============================================
const createDynamicLimiter = (options = {}) => {
    const {
        windowMs = 60 * 1000,
        max = 100,
        message = 'Rate limit exceeded'
    } = options;

    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            error: {
                code: 'CUSTOM_RATE_LIMIT',
                message
            }
        },
        keyGenerator: (req) => {
            return options.keyGenerator 
                ? options.keyGenerator(req) 
                : req.ip;
        },
        ...(store && { store })
    });
};

// =============================================
// 📊 RATE LIMIT MIDDLEWARE WRAPPER
// =============================================
// Ye middleware dynamically decide karega konsa limiter use karna hai
const smartLimiter = (req, res, next) => {
    const path = req.path;
    
    // Auth routes
    if (path.startsWith('/auth/')) {
        return authLimiter(req, res, next);
    }
    
    // LLM & Chat routes
    if (path.startsWith('/llm/') || path.startsWith('/chat/')) {
        return llmLimiter(req, res, next);
    }
    
    // Payment & Billing routes
    if (path.startsWith('/billing/') || path.includes('payment')) {
        return paymentLimiter(req, res, next);
    }
    
    // Telemetry routes
    if (path.startsWith('/telemetry/')) {
        return telemetryLimiter(req, res, next);
    }
    
    // Default API limiter
    return apiLimiter(req, res, next);
};

// =============================================
// 🤫 EXPORT
// =============================================
module.exports = {
    authLimiter,
    apiLimiter,
    llmLimiter,
    telemetryLimiter,
    paymentLimiter,
    publicLimiter,
    createDynamicLimiter,
    smartLimiter
};
