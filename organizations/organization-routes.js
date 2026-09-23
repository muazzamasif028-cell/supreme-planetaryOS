'use strict';

const express = require('express');
const { authenticateToken } = require('../security/auth/jwt-auth');

const { requireOrganization } = require('../security/organizations/require-organization');

const {
    createOrganization,
    getOrganization,
    getOrganizationByName,
    listOrganizations,
    removeOrganization
} = require('./organization-registry');

const router = express.Router();

router.get('/', (req, res) => {
    res.json({
        organizations: listOrganizations()
    });
});

router.get('/:id', (req, res) => {
    const organization =
        getOrganization(req.params.id);

    if (!organization) {
        return res.status(404).json({
            error: 'ORGANIZATION_NOT_FOUND'
        });
    }

    res.json({
        organization
    });
});

router.get('/name/:name', (req, res) => {
    const organization =
        getOrganizationByName(req.params.name);

    if (!organization) {
        return res.status(404).json({
            error: 'ORGANIZATION_NOT_FOUND'
        });
    }

    res.json({
        organization
    });
});

router.post('/', (req, res) => {
    try {
        const organization =
            createOrganization({
                id: req.body?.id,
                name: req.body?.name,
                status: req.body?.status,
                metadata: req.body?.metadata
            });

        return res.status(201).json({
            organization
        });

    } catch (error) {
        return res.status(400).json({
            error: error.message
        });
    }
});

router.delete('/:id', (req, res) => {
    const removed =
        removeOrganization(req.params.id);

    if (!removed) {
        return res.status(404).json({
            error: 'ORGANIZATION_NOT_FOUND'
        });
    }

    res.status(204).end();
});

module.exports = router;
