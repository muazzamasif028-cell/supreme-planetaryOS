const domainService = require('./domain.service');
const tldEngine = require('./tld-engine.service');
const pricingService = require('./pricing.service');
const aiGenerator = require('./ai-generator.service');
const Domain = require('./Domain');
const whoisService = require('./whois.service');
const {
    success,
    created,
    badRequest,
    notFound
} = require('./responseFormatter');

class DomainController {

    async search(req, res) {
        const { domain, tlds } = req.body;

        if (!domain) {
            return badRequest(res, 'Domain is required');
        }

        try {
            const result = await domainService.searchDomain(domain, tlds);
            return success(res, result, 'Domain search completed');
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async aiSuggest(req, res) {
        const { domain } = req.body;

        if (!domain) {
            return badRequest(res, 'Domain is required');
        }

        try {
            const suggestions = await aiGenerator.suggestAlternatives(domain, []);
            return success(
                res,
                { domain, suggestions },
                'AI domain suggestions generated'
            );
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async getSupportedTLDs(req, res) {
        return success(
            res,
            {
                total: domainService.supportedTLDs.length,
                tlds: domainService.supportedTLDs
            },
            'Supported TLDs retrieved'
        );
    }

    async register(req, res) {
        try {
            const domain = await domainService.registerDomain(
                req.userId,
                req.body
            );

            return created(res, domain, 'Domain registration started');
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async transfer(req, res) {
        try {
            const domain = await domainService.transferDomain(
                req.userId,
                req.body
            );

            return created(res, domain, 'Domain transfer started');
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async transferStatus(req, res) {
        try {
            const domain = await domainService.getDomainDetails(
                req.userId,
                req.params.id
            );

            return success(
                res,
                {
                    id: domain._id,
                    domain: domain.fullDomain,
                    status: domain.status,
                    transferLock: domain.transferLock
                },
                'Transfer status retrieved'
            );
        } catch (error) {
            return notFound(res, error.message);
        }
    }

    async getMyDomains(req, res) {
        try {
            const domains = await domainService.getUserDomains(
                req.userId,
                req.query
            );

            return success(
                res,
                {
                    total: domains.length,
                    domains
                },
                'User domains retrieved'
            );
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async getDomainDetails(req, res) {
        try {
            const domain = await domainService.getDomainDetails(
                req.userId,
                req.params.id
            );

            return success(res, domain, 'Domain details retrieved');
        } catch (error) {
            return notFound(res, error.message);
        }
    }

    async renew(req, res) {
        try {
            const years = Number(req.body?.years || 1);

            if (!Number.isInteger(years) || years < 1) {
                return badRequest(res, 'Years must be a positive integer');
            }

            const domain = await domainService.renewDomain(
                req.userId,
                req.params.id,
                years
            );

            return success(res, domain, 'Domain renewed successfully');
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async delete(req, res) {
        try {
            const result = await domainService.deleteDomain(
                req.userId,
                req.params.id
            );

            return success(res, result, 'Domain deleted successfully');
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async toggleLock(req, res) {
        try {
            const domain = await Domain.findOne({
                _id: req.params.id,
                userId: req.userId
            });

            if (!domain) {
                return notFound(res, 'Domain not found');
            }

            const locked = typeof req.body?.locked === 'boolean'
                ? req.body.locked
                : !domain.transferLock;

            domain.transferLock = locked;
            await domain.save();

            return success(
                res,
                {
                    id: domain._id,
                    locked: domain.transferLock
                },
                `Domain transfer lock ${locked ? 'enabled' : 'disabled'}`
            );
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async oneClickDeploy(req, res) {
        try {
            const domain = await domainService.oneClickDeploy(
                req.userId,
                req.params.id
            );

            return success(res, domain, 'Domain deployment completed');
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async deployStatus(req, res) {
        try {
            const domain = await domainService.getDomainDetails(
                req.userId,
                req.params.id
            );

            return success(
                res,
                {
                    id: domain._id,
                    domain: domain.fullDomain,
                    status: domain.deployStatus,
                    progress: domain.deployProgress,
                    log: domain.deployLog || [],
                    connectedServices: domain.connectedServices || {}
                },
                'Deployment status retrieved'
            );
        } catch (error) {
            return notFound(res, error.message);
        }
    }

    async getWhois(req, res) {
        try {
            const domain = await domainService.getDomainDetails(
                req.userId,
                req.params.id
            );

            const whois = await whoisService.lookup(domain.fullDomain);

            return success(
                res,
                {
                    domain: domain.fullDomain,
                    whois
                },
                'WHOIS information retrieved'
            );
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async getAllTLDs(req, res) {
        const result = tldEngine.searchTLDs('', req.query);
        return success(res, result, 'All TLDs retrieved');
    }

    async getPopularTLDs(req, res) {
        const limit = Number(req.query.limit || 20);
        return success(
            res,
            tldEngine.getPopularTLDs(limit),
            'Popular TLDs retrieved'
        );
    }

    async getCountryTLDs(req, res) {
        return success(
            res,
            tldEngine.getCountryTLDs(),
            'Country TLDs retrieved'
        );
    }

    async searchTLDs(req, res) {
        const { q = '', ...filters } = req.query;
        return success(
            res,
            tldEngine.searchTLDs(q, filters),
            'TLD search completed'
        );
    }

    async getTLDDetails(req, res) {
        const tld = String(req.params.tld || '').toLowerCase();
        const result = tldEngine.getTLD(tld);

        if (!result) {
            return notFound(res, `TLD .${tld} not found`);
        }

        return success(res, result, 'TLD details retrieved');
    }

    async syncTLDs(req, res) {
        try {
            const result = await tldEngine.syncFromIANA();
            return success(res, result, 'TLD catalog synchronized');
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async getPricingTiers(req, res) {
        return success(
            res,
            pricingService.getQuantumTiers(),
            'Pricing tiers retrieved'
        );
    }

    async compareTiers(req, res) {
        return success(
            res,
            pricingService.compareTiers(),
            'Pricing tiers compared'
        );
    }

    async calculatePrice(req, res) {
        const {
            domain,
            tld,
            quantumTier = 'standard',
            years = 1,
            ...options
        } = req.body;

        if (!tld) {
            return badRequest(res, 'TLD is required');
        }

        try {
            const result = pricingService.calculatePrice(
                domain || 'example',
                tld,
                quantumTier,
                years,
                {
                    ...options,
                    country: options.country || 'US',
                    tld
                }
            );

            return success(res, result, 'Domain price calculated');
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async getEnterpriseQuote(req, res) {
        try {
            const result = pricingService.getEnterpriseQuote(req.body);
            return success(res, result, 'Enterprise quote generated');
        } catch (error) {
            return badRequest(res, error.message);
        }
    }
}

module.exports = new DomainController();
