const Domain = require('./Domain');
const {
    success,
    created,
    badRequest,
    notFound
} = require('./responseFormatter');

class DNSController {

    async getRecords(req, res) {
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
                    records: domain.dnsRecords || []
                },
                'DNS records retrieved'
            );
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async addRecord(req, res) {
        try {
            const domain = await Domain.findOne({
                _id: req.params.id,
                userId: req.userId
            });

            if (!domain) {
                return notFound(res, 'Domain not found');
            }

            const {
                type,
                name = '@',
                value,
                ttl = 3600,
                priority = null,
                proxied = false,
                locked = false
            } = req.body;

            if (!type || !value) {
                return badRequest(res, 'DNS record type and value are required');
            }

            const record = {
                type,
                name,
                value,
                ttl,
                priority,
                proxied,
                locked
            };

            await domain.addDNSRecord(record);

            return created(
                res,
                domain.dnsRecords[domain.dnsRecords.length - 1],
                'DNS record added'
            );
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async updateRecord(req, res) {
        try {
            const domain = await Domain.findOne({
                _id: req.params.id,
                userId: req.userId
            });

            if (!domain) {
                return notFound(res, 'Domain not found');
            }

            const record = domain.dnsRecords.id(req.params.recordId);

            if (!record) {
                return notFound(res, 'DNS record not found');
            }

            if (record.locked) {
                return badRequest(res, 'Locked DNS record cannot be modified');
            }

            const allowed = [
                'type',
                'name',
                'value',
                'ttl',
                'priority',
                'proxied'
            ];

            const updates = {};

            for (const field of allowed) {
                if (req.body[field] !== undefined) {
                    updates[field] = req.body[field];
                }
            }

            await domain.updateDNSRecord(req.params.recordId, updates);

            return success(
                res,
                domain.dnsRecords.id(req.params.recordId),
                'DNS record updated'
            );
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async deleteRecord(req, res) {
        try {
            const domain = await Domain.findOne({
                _id: req.params.id,
                userId: req.userId
            });

            if (!domain) {
                return notFound(res, 'Domain not found');
            }

            const record = domain.dnsRecords.id(req.params.recordId);

            if (!record) {
                return notFound(res, 'DNS record not found');
            }

            if (record.locked) {
                return badRequest(res, 'Locked DNS record cannot be deleted');
            }

            await domain.removeDNSRecord(req.params.recordId);

            return success(
                res,
                {
                    recordId: req.params.recordId,
                    deleted: true
                },
                'DNS record deleted'
            );
        } catch (error) {
            return badRequest(res, error.message);
        }
    }

    async bulkAddRecords(req, res) {
        try {
            const domain = await Domain.findOne({
                _id: req.params.id,
                userId: req.userId
            });

            if (!domain) {
                return notFound(res, 'Domain not found');
            }

            if (!Array.isArray(req.body?.records)) {
                return badRequest(res, 'records must be an array');
            }

            if (req.body.records.length === 0) {
                return badRequest(res, 'At least one DNS record is required');
            }

            for (const record of req.body.records) {
                if (!record?.type || !record?.value) {
                    return badRequest(
                        res,
                        'Every DNS record requires type and value'
                    );
                }

                await domain.addDNSRecord({
                    type: record.type,
                    name: record.name ?? '@',
                    value: record.value,
                    ttl: record.ttl ?? 3600,
                    priority: record.priority ?? null,
                    proxied: record.proxied ?? false,
                    locked: record.locked ?? false
                });
            }

            return success(
                res,
                {
                    added: req.body.records.length,
                    records: domain.dnsRecords
                },
                'DNS records added successfully'
            );
        } catch (error) {
            return badRequest(res, error.message);
        }
    }
}

module.exports = new DNSController();
