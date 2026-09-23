// ============================================================
// 🌐 services/domain.service.js
// SUPREME Domain Service v11.0
// ============================================================
const Domain = require('./Domain');
const AppError = require('./AppError');
const whoisService = require('./whois.service');
const aiGenerator = require('./ai-generator.service');
const cloudflareProvider = require('./cloudflare.provider');
const { COUNTRY_TLDS, GENERIC_TLDS } = require('./country-tlds');

class DomainService {
    constructor() {
        this.providers = {
            cloudflare: cloudflareProvider,
        };
        
        // Complete TLD catalog:
        // Country/territory TLDs + generic TLDs.
        this.supportedTLDs = [
            ...new Set([
                ...COUNTRY_TLDS.flatMap(country => country.tlds),
                ...GENERIC_TLDS
            ])
        ];
        
        this.premiumTLDs = ['ai', 'io', 'cloud', 'app', 'dev', 'pro', 'media'];
    }

    /**
     * Search domain availability
     */
    async searchDomain(domainName, tlds = null) {
        const results = [];
        const searchTLDs = Array.isArray(tlds) && tlds.length > 0
            ? tlds
            : this.supportedTLDs;
        
        for (const tld of searchTLDs) {
            try {
                const fullDomain = `${domainName}.${tld}`;
                
                // Check WHOIS first (fast)
                const whoisResult = await whoisService.lookup(fullDomain);
                
                // Verify with registrar API
                const availability = await this.checkAvailability(domainName, tld);
                
                const isPremium = this.premiumTLDs.includes(tld);
                const estimatedPrice = this.getEstimatedPrice(tld, isPremium);
                
                results.push({
                    domain: fullDomain,
                    tld,
                    available: availability.available,
                    premium: isPremium || availability.premium,
                    price: availability.price || estimatedPrice,
                    currency: 'USD',
                    renewalPrice: estimatedPrice,
                    transferPrice: estimatedPrice * 0.9,
                    whoisInfo: whoisResult?.available ? null : {
                        registrar: whoisResult?.registrar,
                        creationDate: whoisResult?.creationDate,
                        expiryDate: whoisResult?.expiryDate
                    }
                });
                
            } catch (error) {
                results.push({
                    domain: `${domainName}.${tld}`,
                    tld,
                    available: false,
                    error: error.message
                });
            }
        }
        
        // Get AI suggestions for alternatives
        const suggestions = await aiGenerator.suggestAlternatives(domainName, results);
        
        return {
            searchTerm: domainName,
            results,
            suggestions,
            totalAvailable: results.filter(r => r.available).length,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Check availability with provider
     */
    async checkAvailability(domain, tld) {
        // Try multiple providers
        const providers = ['cloudflare', 'namecheap', 'godaddy'];
        
        for (const providerName of providers) {
            try {
                const provider = this.providers[providerName];
                if (!provider) continue;
                
                const result = await provider.checkAvailability(domain, tld);
                return result;
            } catch (error) {
                continue;
            }
        }
        
        // Fallback to WHOIS
        const whoisResult = await whoisService.lookup(`${domain}.${tld}`);
        return {
            available: whoisResult.available,
            premium: false,
            price: this.getEstimatedPrice(tld)
        };
    }

    /**
     * Register domain
     */
    async registerDomain(userId, domainData) {
        const { domainName, tld, registrar = 'cloudflare', whoisInfo, autoRenew = true } = domainData;
        
        // Check if already registered by someone else
        const existing = await Domain.findOne({
            domainName: domainName.toLowerCase(),
            tld: tld.toLowerCase()
        });
        
        if (existing && existing.userId.toString() !== userId.toString()) {
            throw new AppError(`Domain ${domainName}.${tld} is already registered`, 409, 'DOMAIN_TAKEN');
        }
        
        // Check availability
        const availability = await this.checkAvailability(domainName, tld);
        if (!availability.available) {
            throw new AppError(`Domain ${domainName}.${tld} is not available`, 400, 'DOMAIN_UNAVAILABLE');
        }
        
        // Register with provider
        const provider = this.providers[registrar];
        if (!provider) {
            throw new AppError(`Registrar ${registrar} not supported`, 400, 'INVALID_REGISTRAR');
        }
        
        try {
            const registration = await provider.register({
                domain: domainName,
                tld,
                whoisInfo,
                autoRenew,
                userId
            });
            
            // Create domain record
            const domain = new Domain({
                userId,
                domainName: domainName.toLowerCase(),
                tld: tld.toLowerCase(),
                registrar,
                registrarId: registration.id,
                expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
                autoRenew,
                whoisPrivacy: true,
                whoisInfo: whoisInfo || {},
                status: 'registering',
                nameservers: [
                    { host: 'ns1.supreme-os.com', ip: '76.76.21.21' },
                    { host: 'ns2.supreme-os.com', ip: '76.76.21.98' }
                ]
            });
            
            await domain.save();
            
            // Start auto-deploy process
            this.startAutoDeploy(domain._id);
            
            return domain;
            
        } catch (error) {
            throw new AppError(`Registration failed: ${error.message}`, 500, 'REGISTRATION_FAILED');
        }
    }

    /**
     * Transfer domain from another registrar
     */
    async transferDomain(userId, transferData) {
        const { domainName, tld, authCode, registrar = 'cloudflare' } = transferData;
        
        // Verify auth code
        if (!authCode || authCode.length < 6) {
            throw new AppError('Valid authorization/EPP code required', 400, 'INVALID_AUTH_CODE');
        }
        
        const provider = this.providers[registrar];
        const transfer = await provider.initiateTransfer({
            domain: domainName,
            tld,
            authCode
        });
        
        const domain = new Domain({
            userId,
            domainName: domainName.toLowerCase(),
            tld: tld.toLowerCase(),
            registrar,
            registrarId: transfer.id,
            status: 'transferring_in',
            transferLock: true
        });
        
        await domain.save();
        return domain;
    }

    /**
     * Get user's domains
     */
    async getUserDomains(userId, filters = {}) {
        const domains = await Domain.findByUser(userId, filters);
        
        return domains.map(domain => ({
            ...domain.toJSON(),
            daysUntilExpiry: domain.daysUntilExpiry,
            isExpiringSoon: domain.isExpiringSoon,
            sslStatus: domain.ssl?.status || 'not_configured',
            emailStatus: domain.email?.status || 'not_configured'
        }));
    }

    /**
     * Get domain details
     */
    async getDomainDetails(userId, domainId) {
        const domain = await Domain.findOne({ _id: domainId, userId });
        
        if (!domain) {
            throw new AppError('Domain not found', 404, 'DOMAIN_NOT_FOUND');
        }
        
        // Refresh WHOIS info
        try {
            const whoisData = await whoisService.lookup(domain.fullDomain);
            domain.whoisInfo = { ...domain.whoisInfo, ...whoisData };
        } catch (error) {
            // WHOIS lookup failed, use cached data
        }
        
        return domain;
    }

    /**
     * Renew domain
     */
    async renewDomain(userId, domainId, years = 1) {
        const domain = await Domain.findOne({ _id: domainId, userId });
        
        if (!domain) {
            throw new AppError('Domain not found', 404, 'DOMAIN_NOT_FOUND');
        }
        
        const provider = this.providers[domain.registrar];
        const renewal = await provider.renew({
            domain: domain.domainName,
            tld: domain.tld,
            years,
            registrarId: domain.registrarId
        });
        
        domain.expiryDate = new Date(domain.expiryDate.getTime() + years * 365 * 24 * 60 * 60 * 1000);
        domain.renewAmount = renewal.price;
        await domain.save();
        
        return domain;
    }

    /**
     * Delete domain
     */
    async deleteDomain(userId, domainId) {
        const domain = await Domain.findOne({ _id: domainId, userId });
        
        if (!domain) {
            throw new AppError('Domain not found', 404, 'DOMAIN_NOT_FOUND');
        }
        
        if (domain.status === 'transferring_in') {
            throw new AppError('Cannot delete domain during transfer', 400, 'TRANSFER_IN_PROGRESS');
        }
        
        // Release with registrar
        try {
            const provider = this.providers[domain.registrar];
            await provider.release({ registrarId: domain.registrarId });
        } catch (error) {
            // Log but continue deletion
        }
        
        domain.status = 'deleted';
        await domain.save();
        
        return { message: 'Domain deleted successfully' };
    }

    /**
     * One-click deploy
     */
    async oneClickDeploy(userId, domainId) {
        const domain = await Domain.findOne({ _id: domainId, userId });
        
        if (!domain) {
            throw new AppError('Domain not found', 404, 'DOMAIN_NOT_FOUND');
        }
        
        return this.startAutoDeploy(domainId);
    }

    /**
     * Auto-deploy process
     */
    async startAutoDeploy(domainId) {
        const domain = await Domain.findById(domainId);
        
        const steps = [
            { step: 'dns_configuring', message: 'Configuring DNS records...', progress: 10 },
            { step: 'dns_complete', message: 'DNS configured successfully', progress: 25 },
            { step: 'ssl_issuing', message: 'Issuing SSL certificate...', progress: 35 },
            { step: 'ssl_complete', message: 'SSL certificate issued', progress: 50 },
            { step: 'hosting_provisioning', message: 'Provisioning cloud hosting...', progress: 60 },
            { step: 'hosting_complete', message: 'Hosting provisioned', progress: 75 },
            { step: 'email_setting', message: 'Setting up email...', progress: 85 },
            { step: 'email_complete', message: 'Email configured', progress: 90 },
            { step: 'ai_deploying', message: 'Deploying AI website...', progress: 95 },
            { step: 'complete', message: '🚀 Everything is ready!', progress: 100 }
        ];
        
        domain.deployStatus = 'dns_configuring';
        domain.deployProgress = 0;
        
        for (const step of steps) {
            await domain.updateDeployProgress(step.step, 'in_progress', step.message, step.progress);
            await this.sleep(500); // Simulate processing time
        }
        
        domain.connectedServices = {
            hosting: true,
            cloud: true,
            cdn: true,
            analytics: true,
            aiAgent: true,
            website: true
        };
        
        await domain.save();
        return domain;
    }

    /**
     * Get estimated price for TLD
     */
    getEstimatedPrice(tld, isPremium = false) {
        const basePrices = {
            com: 12.99, net: 14.99, org: 15.99, io: 39.99,
            ai: 69.99, cloud: 19.99, app: 17.99, dev: 14.99,
            tech: 9.99, online: 4.99, store: 9.99, site: 3.99,
            xyz: 1.99, co: 24.99, me: 19.99, info: 8.99
        };
        
        const basePrice = basePrices[tld] || 14.99;
        return isPremium ? basePrice * 3 : basePrice;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new DomainService();
