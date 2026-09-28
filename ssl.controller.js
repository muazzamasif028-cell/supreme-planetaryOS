const Domain = require('./Domain');
const {
    success,
    badRequest,
    notFound
} = require('./responseFormatter');

class SSLController {

    async getStatus(req, res) {
        try {
            const domain = await Domain.findOne({
                _id: req.params.id,
                userId: req.userId
            });

            if (!domain) {
                return notFound(res, 'Domain not found');
            }

            return success(
                res,
                {
                    domain: domain.fullDomain,
                    ssl: domain.ssl || {
                        status: 'not_configured'
                    }
                },
                'SSL status retrieved'
            );
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async issue(req, res) {
        try {
            const domain = await Domain.findOne({
                _id: req.params.id,
                userId: req.userId
            });

            if (!domain) {
                return notFound(res, 'Domain not found');
            }

            const requestedType = req.body?.type || 'free';

            const allowedTypes = [
                'free',
                'premium',
                'wildcard',
                'enterprise'
            ];

            if (!allowedTypes.includes(requestedType)) {
                return badRequest(res, 'Invalid SSL certificate type');
            }

            domain.ssl = {
                type: requestedType,
                status: 'pending',
                provider: req.body?.provider || 'letsencrypt',
                certificateId: null,
                issuedAt: null,
                expiresAt: null,
                autoRenew: req.body?.autoRenew !== false,
                domains: [domain.fullDomain],
                fingerprint: null,
                issuer: null
            };

            await domain.save();

            return success(
                res,
                {
                    domain: domain.fullDomain,
                    ssl: domain.ssl,
                    mode: 'configuration_only',
                    message: 'SSL issuance is queued. Certificate provisioning requires an ACME/SSL provider integration.'
                },
                'SSL issuance queued'
            );
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async renew(req, res) {
        try {
            const domain = await Domain.findOne({
                _id: req.params.id,
                userId: req.userId
            });

            if (!domain) {
                return notFound(res, 'Domain not found');
            }

            if (!domain.ssl || !['issued', 'active'].includes(domain.ssl.status)) {
                return badRequest(
                    res,
                    'SSL certificate is not active and cannot be renewed'
                );
            }

            const days = Number(req.body?.days || 90);

            if (!Number.isInteger(days) || days < 1) {
                return badRequest(res, 'days must be a positive integer');
            }

            const currentExpiry =
                domain.ssl.expiresAt &&
                new Date(domain.ssl.expiresAt) > new Date()
                    ? new Date(domain.ssl.expiresAt)
                    : new Date();

            currentExpiry.setDate(currentExpiry.getDate() + days);

            domain.ssl.expiresAt = currentExpiry;
            domain.ssl.autoRenew = req.body?.autoRenew !== false;

            await domain.save();

            return success(
                res,
                {
                    domain: domain.fullDomain,
                    ssl: domain.ssl,
                    mode: 'local_state'
                },
                'SSL renewal state updated'
            );
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async revoke(req, res) {
        try {
            const domain = await Domain.findOne({
                _id: req.params.id,
                userId: req.userId
            });

            if (!domain) {
                return notFound(res, 'Domain not found');
            }

            if (!domain.ssl) {
                return success(
                    res,
                    {
                        domain: domain.fullDomain,
                        status: 'not_configured'
                    },
                    'No SSL certificate configured'
                );
            }

            domain.ssl.status = 'revoked';
            domain.ssl.autoRenew = false;

            await domain.save();

            return success(
                res,
                {
                    domain: domain.fullDomain,
                    ssl: domain.ssl
                },
                'SSL certificate state revoked'
            );
        } catch (error) {
            return badRequest(res, error.message);
        }
    }
}

module.exports = new SSLController();
