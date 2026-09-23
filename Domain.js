const mongoose = require('mongoose');

// ============================================================
// DNS RECORD
// ============================================================
const DNSRecordSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'PTR', 'SOA'],
        required: true
    },
    name: {
        type: String,
        default: '@',
        trim: true
    },
    value: {
        type: String,
        required: true,
        trim: true
    },
    ttl: {
        type: Number,
        default: 3600,
        min: 60,
        max: 86400
    },
    priority: {
        type: Number,
        default: null
    },
    proxied: {
        type: Boolean,
        default: false
    },
    locked: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// ============================================================
// SSL CERTIFICATE
// ============================================================
const SSLCertificateSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['free', 'premium', 'wildcard', 'enterprise'],
        default: 'free'
    },

    status: {
        type: String,
        enum: ['not_configured', 'pending', 'issued', 'active', 'expired', 'revoked', 'failed'],
        default: 'not_configured'
    },

    provider: {
        type: String,
        default: 'letsencrypt'
    },

    certificateId: String,

    issuedAt: Date,

    expiresAt: Date,

    autoRenew: {
        type: Boolean,
        default: true
    },

    domains: [{
        type: String,
        lowercase: true,
        trim: true
    }],

    fingerprint: String,

    issuer: String
}, {
    _id: false
});

// ============================================================
// EMAIL SETUP
// ============================================================
const EmailAccountSchema = new mongoose.Schema({
    email: {
        type: String,
        lowercase: true,
        trim: true
    },

    type: {
        type: String,
        enum: ['admin', 'user', 'catchall', 'forward'],
        default: 'user'
    },

    status: {
        type: String,
        enum: ['active', 'suspended', 'pending'],
        default: 'pending'
    }
}, {
    timestamps: true
});

const EmailSetupSchema = new mongoose.Schema({
    status: {
        type: String,
        enum: ['not_configured', 'configuring', 'active', 'failed'],
        default: 'not_configured'
    },

    provider: {
        type: String,
        default: null
    },

    accounts: [EmailAccountSchema],

    spfRecord: String,

    dkimRecord: String,

    dmarcRecord: String,

    mxRecords: [String]
}, {
    _id: false
});

// ============================================================
// NAMESERVER
// ============================================================
const NameserverSchema = new mongoose.Schema({
    host: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },

    ip: {
        type: String,
        default: null
    },

    priority: {
        type: Number,
        default: 1
    }
}, {
    _id: false
});

// ============================================================
// DEPLOY LOG
// ============================================================
const DeployLogSchema = new mongoose.Schema({
    step: String,

    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'failed'],
        default: 'pending'
    },

    message: String,

    progress: {
        type: Number,
        min: 0,
        max: 100
    },

    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    _id: false
});

// ============================================================
// MAIN DOMAIN SCHEMA
// ============================================================
const DomainSchema = new mongoose.Schema({

    // --------------------------------------------------------
    // OWNER
    // --------------------------------------------------------

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // --------------------------------------------------------
    // DOMAIN
    // --------------------------------------------------------

    domainName: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true,
        match: /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
    },

    tld: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        match: /^[a-z0-9-]+$/
    },

    // --------------------------------------------------------
    // REGISTRAR
    // --------------------------------------------------------

    registrar: {
        type: String,
        enum: [
            'cloudflare',
            'namecheap',
            'godaddy',
            'opensrs',
            'enom',
            'custom'
        ],
        default: 'custom'
    },

    registrarId: {
        type: String,
        default: null
    },

    registrationDate: {
        type: Date,
        default: Date.now
    },

    expiryDate: {
        type: Date,
        default: null
    },

    autoRenew: {
        type: Boolean,
        default: true
    },

    renewAmount: Number,

    currency: {
        type: String,
        default: 'USD'
    },

    // --------------------------------------------------------
    // DOMAIN STATUS
    // --------------------------------------------------------

    status: {
        type: String,

        enum: [
            'searching',
            'available',
            'registering',
            'registered',
            'transferring',
            'transferring_in',
            'transfer_complete',
            'expired',
            'suspended',
            'locked',
            'deleted',
            'error'
        ],

        default: 'searching',

        index: true
    },

    transferLock: {
        type: Boolean,
        default: true
    },

    whoisPrivacy: {
        type: Boolean,
        default: true
    },

    dnssecEnabled: {
        type: Boolean,
        default: false
    },

    // --------------------------------------------------------
    // DNS
    // --------------------------------------------------------

    dnsRecords: {
        type: [DNSRecordSchema],
        default: []
    },

    nameservers: {
        type: [NameserverSchema],
        default: []
    },

    // --------------------------------------------------------
    // SSL
    // --------------------------------------------------------

    ssl: {
        type: SSLCertificateSchema,
        default: () => ({})
    },

    // --------------------------------------------------------
    // EMAIL
    // --------------------------------------------------------

    email: {
        type: EmailSetupSchema,
        default: () => ({})
    },

    // --------------------------------------------------------
    // WHOIS / REGISTRANT
    // --------------------------------------------------------

    whoisInfo: {

        firstName: String,

        lastName: String,

        registrant: String,

        organization: String,

        email: String,

        phone: String,

        address: String,

        city: String,

        state: String,

        country: String,

        zipCode: String
    },

    // --------------------------------------------------------
    // CONNECTED SERVICES
    // --------------------------------------------------------

    connectedServices: {

        hosting: {
            type: Boolean,
            default: false
        },

        cloud: {
            type: Boolean,
            default: false
        },

        cdn: {
            type: Boolean,
            default: false
        },

        analytics: {
            type: Boolean,
            default: false
        },

        aiAgent: {
            type: Boolean,
            default: false
        },

        website: {
            type: Boolean,
            default: false
        }
    },

    // --------------------------------------------------------
    // DEPLOYMENT
    // --------------------------------------------------------

    deployStatus: {

        type: String,

        enum: [
            'not_started',
            'dns_configuring',
            'ssl_issuing',
            'hosting_provisioning',
            'email_setting',
            'ai_deploying',
            'complete',
            'failed'
        ],

        default: 'not_started'
    },

    deployProgress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },

    deployLog: {
        type: [DeployLogSchema],
        default: []
    },

    // --------------------------------------------------------
    // PRICING
    // --------------------------------------------------------

    isPremium: {
        type: Boolean,
        default: false
    },

    premiumPrice: {
        type: Number,
        default: null
    },

    purchasePrice: {
        type: Number,
        default: null
    },

    // --------------------------------------------------------
    // METADATA
    // --------------------------------------------------------

    tags: {
        type: [String],
        default: []
    },

    notes: {
        type: String,
        default: null
    },

    // --------------------------------------------------------
    // AI DATA
    // --------------------------------------------------------

    aiGenerated: {

        suggested: {
            type: Boolean,
            default: false
        },

        alternatives: {
            type: [String],
            default: []
        },

        brandScore: {
            type: Number,
            min: 0,
            max: 100
        },

        seoScore: {
            type: Number,
            min: 0,
            max: 100
        }
    }

}, {
    timestamps: true,

    toJSON: {
        virtuals: true
    },

    toObject: {
        virtuals: true
    }
});

// ============================================================
// INDEXES
// ============================================================

// IMPORTANT:
// This allows:
// company.com
// company.net
// company.org
//
// But prevents duplicate:
// company.com + company.com

DomainSchema.index(
    {
        domainName: 1,
        tld: 1
    },
    {
        unique: true
    }
);

DomainSchema.index({
    userId: 1,
    status: 1
});

DomainSchema.index({
    expiryDate: 1
});

DomainSchema.index({
    'ssl.expiresAt': 1
});

DomainSchema.index({
    domainName: 'text',
    tld: 'text'
});

// ============================================================
// VIRTUALS
// ============================================================

DomainSchema.virtual('fullDomain').get(function () {
    return `${this.domainName}.${this.tld}`;
});

DomainSchema.virtual('daysUntilExpiry').get(function () {

    if (!this.expiryDate) {
        return null;
    }

    const difference =
        this.expiryDate.getTime() -
        Date.now();

    return Math.ceil(
        difference /
        (1000 * 60 * 60 * 24)
    );
});

DomainSchema.virtual('isExpiringSoon').get(function () {

    const days =
        this.daysUntilExpiry;

    return (
        days !== null &&
        days > 0 &&
        days <= 30
    );
});

DomainSchema.virtual('isExpired').get(function () {

    const days =
        this.daysUntilExpiry;

    return (
        days !== null &&
        days <= 0
    );
});

// ============================================================
// METHODS
// ============================================================

DomainSchema.methods.addDNSRecord =
async function (record) {

    this.dnsRecords.push(record);

    return this.save();
};

DomainSchema.methods.removeDNSRecord =
async function (recordId) {

    this.dnsRecords.id(recordId)?.deleteOne();

    return this.save();
};

DomainSchema.methods.updateDNSRecord =
async function (recordId, updates) {

    const record =
        this.dnsRecords.id(recordId);

    if (!record) {
        throw new Error('DNS record not found');
    }

    Object.assign(
        record,
        updates
    );

    return this.save();
};

DomainSchema.methods.updateDeployProgress =
async function (
    step,
    status,
    message,
    progress
) {

    this.deployLog.push({
        step,
        status,
        message,
        progress,
        timestamp: new Date()
    });

    this.deployProgress = progress;

    if (progress >= 100) {
        this.deployStatus = 'complete';
    }

    if (status === 'failed') {
        this.deployStatus = 'failed';
    }

    return this.save();
};

// ============================================================
// STATICS
// ============================================================

DomainSchema.statics.findExpiringSoon =
function (days = 30) {

    const now =
        new Date();

    const futureDate =
        new Date();

    futureDate.setDate(
        futureDate.getDate() + days
    );

    return this.find({

        expiryDate: {
            $gte: now,
            $lte: futureDate
        },

        status: 'registered',

        autoRenew: true
    });
};

DomainSchema.statics.findByUser =
function (
    userId,
    filters = {}
) {

    return this.find({
        userId,
        ...filters
    })
        .sort({
            createdAt: -1
        });
};

// ============================================================
// EXPORT
// ============================================================

module.exports =
mongoose.models.Domain ||
mongoose.model(
    'Domain',
    DomainSchema
);
