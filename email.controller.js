const Domain = require('./Domain');
const {
    success,
    created,
    badRequest,
    notFound
} = require('./responseFormatter');

class EmailController {

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
                    email: domain.email || {
                        status: 'not_configured'
                    }
                },
                'Email status retrieved'
            );
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async setup(req, res) {
        try {
            const domain = await Domain.findOne({
                _id: req.params.id,
                userId: req.userId
            });

            if (!domain) {
                return notFound(res, 'Domain not found');
            }

            const provider = req.body?.provider || 'supreme';

            domain.email = {
                status: 'configuring',
                provider,
                accounts: domain.email?.accounts || [],
                spfRecord:
                    req.body?.spfRecord ||
                    `v=spf1 include:${domain.fullDomain} ~all`,
                dkimRecord:
                    req.body?.dkimRecord || null,
                dmarcRecord:
                    req.body?.dmarcRecord ||
                    `v=DMARC1; p=none;`,
                mxRecords:
                    Array.isArray(req.body?.mxRecords)
                        ? req.body.mxRecords
                        : domain.email?.mxRecords || []
            };

            await domain.save();

            return success(
                res,
                {
                    domain: domain.fullDomain,
                    email: domain.email,
                    mode: 'configuration_only'
                },
                'Email setup initialized'
            );
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async addAccount(req, res) {
        try {
            const domain = await Domain.findOne({
                _id: req.params.id,
                userId: req.userId
            });

            if (!domain) {
                return notFound(res, 'Domain not found');
            }

            const {
                email,
                type = 'user'
            } = req.body;

            if (!email) {
                return badRequest(res, 'Email address is required');
            }

            const normalizedEmail = String(email).toLowerCase().trim();

            const allowedTypes = [
                'admin',
                'user',
                'catchall',
                'forward'
            ];

            if (!allowedTypes.includes(type)) {
                return badRequest(res, 'Invalid email account type');
            }

            domain.email = domain.email || {
                status: 'configuring',
                provider: 'supreme',
                accounts: []
            };

            if (domain.email.accounts.some(
                account => account.email === normalizedEmail
            )) {
                return badRequest(res, 'Email account already exists');
            }

            domain.email.accounts.push({
                email: normalizedEmail,
                type,
                status: 'pending'
            });

            await domain.save();

            const account =
                domain.email.accounts[
                    domain.email.accounts.length - 1
                ];

            return created(
                res,
                account,
                'Email account added'
            );
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async getRequiredDNSRecords(req, res) {
        try {
            const domain = await Domain.findOne({
                _id: req.params.id,
                userId: req.userId
            });

            if (!domain) {
                return notFound(res, 'Domain not found');
            }

            const email = domain.email || {};

            return success(
                res,
                {
                    domain: domain.fullDomain,
                    records: {
                        mx: email.mxRecords || [],
                        spf: email.spfRecord || null,
                        dkim: email.dkimRecord || null,
                        dmarc: email.dmarcRecord || null
                    }
                },
                'Required email DNS records retrieved'
            );
        } catch (error) {
            return badRequest(res, error.message);
        }
    }
}

module.exports = new EmailController();
