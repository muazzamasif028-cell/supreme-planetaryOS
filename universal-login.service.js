// ============================================================
// 🌌 services/universal-login.service.js
// SUPREME Universal Login — One Login, Entire Platform
// ============================================================
const jwt = require('jsonwebtoken');
const UniversalIdentity = require('../models/UniversalIdentity');
const AppError = require('./AppError');

class UniversalLoginService {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET;
        this.jwtExpiry = '7d';
        this.refreshTokenExpiry = '30d';
        this.supportedProviders = [
            'google', 'github', 'microsoft', 'apple', 'facebook',
            'twitter', 'linkedin', 'discord', 'gitlab', 'bitbucket'
        ];
    }

    /**
     * Universal Login — Any provider, one identity
     */
    async login(provider, providerData) {
        const { providerId, email, name, avatar } = providerData;
        
        // Find or create universal identity
        let identity = await UniversalIdentity.findOne({
            $or: [
                { 'identities.provider': provider, 'identities.providerId': providerId },
                { 'unifiedProfile.emails': email }
            ]
        });
        
        if (identity) {
            // Update existing identity
            await this.updateIdentity(identity, provider, providerData);
        } else {
            // Create new universal identity
            identity = await this.createIdentity(provider, providerData);
        }
        
        // Generate tokens
        const tokens = this.generateTokens(identity);
        
        // Update login stats
        identity.stats.totalLogins++;
        identity.stats.lastLoginAt = new Date();
        await identity.save();
        
        return {
            identity: this.sanitizeIdentity(identity),
            tokens
        };
    }

    /**
     * Create new universal identity
     */
    async createIdentity(provider, data) {
        const supremeId = this.generateSupremeId();
        
        const identity = new UniversalIdentity({
            supremeId,
            displayName: data.name || data.email?.split('@')[0],
            avatar: data.avatar,
            identities: [{
                provider,
                providerId: data.providerId,
                email: data.email,
                name: data.name,
                avatar: data.avatar,
                connectedAt: new Date(),
                lastLoginAt: new Date(),
                isPrimary: true
            }],
            unifiedProfile: {
                emails: [data.email],
                phoneNumbers: data.phone ? [data.phone] : []
            }
        });
        
        await identity.save();
        return identity;
    }

    /**
     * Update existing identity with new provider
     */
    async updateIdentity(identity, provider, data) {
        const existingProvider = identity.identities.find(
            i => i.provider === provider && i.providerId === data.providerId
        );
        
        if (existingProvider) {
            existingProvider.lastLoginAt = new Date();
            existingProvider.avatar = data.avatar || existingProvider.avatar;
        } else {
            identity.identities.push({
                provider,
                providerId: data.providerId,
                email: data.email,
                name: data.name,
                avatar: data.avatar,
                connectedAt: new Date(),
                lastLoginAt: new Date(),
                isPrimary: false
            });
        }
        
        // Add email if new
        if (data.email && !identity.unifiedProfile.emails.includes(data.email)) {
            identity.unifiedProfile.emails.push(data.email);
        }
        
        await identity.save();
    }

    /**
     * Link additional provider to existing identity
     */
    async linkProvider(supremeId, provider, providerData) {
        const identity = await UniversalIdentity.findOne({ supremeId });
        
        if (!identity) {
            throw new AppError('Identity not found', 404);
        }
        
        await this.updateIdentity(identity, provider, providerData);
        
        return this.sanitizeIdentity(identity);
    }

    /**
     * Unlink provider from identity
     */
    async unlinkProvider(supremeId, provider) {
        const identity = await UniversalIdentity.findOne({ supremeId });
        
        if (!identity) {
            throw new AppError('Identity not found', 404);
        }
        
        // Don't allow removing last provider
        if (identity.identities.length <= 1) {
            throw new AppError('Cannot remove last connected identity', 400);
        }
        
        identity.identities = identity.identities.filter(i => i.provider !== provider);
        
        // If primary was removed, set new primary
        if (!identity.identities.some(i => i.isPrimary)) {
            identity.identities[0].isPrimary = true;
        }
        
        await identity.save();
        return this.sanitizeIdentity(identity);
    }

    /**
     * Generate JWT tokens
     */
    generateTokens(identity) {
        const payload = {
            supremeId: identity.supremeId,
            displayName: identity.displayName,
            email: identity.primaryEmail,
            securityLevel: identity.securityLevel
        };
        
        const accessToken = jwt.sign(payload, this.jwtSecret, {
            expiresIn: this.jwtExpiry
        });
        
        const refreshToken = jwt.sign(
            { supremeId: identity.supremeId, type: 'refresh' },
            this.jwtSecret,
            { expiresIn: this.refreshTokenExpiry }
        );
        
        return {
            accessToken,
            refreshToken,
            expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
            tokenType: 'Bearer'
        };
    }

    /**
     * Refresh access token
     */
    async refreshAccessToken(refreshToken) {
        try {
            const decoded = jwt.verify(refreshToken, this.jwtSecret);
            
            if (decoded.type !== 'refresh') {
                throw new AppError('Invalid refresh token', 401);
            }
            
            const identity = await UniversalIdentity.findOne({
                supremeId: decoded.supremeId
            });
            
            if (!identity) {
                throw new AppError('Identity not found', 404);
            }
            
            return this.generateTokens(identity);
            
        } catch (error) {
            throw new AppError('Invalid or expired refresh token', 401);
        }
    }

    /**
     * Generate unique Supreme ID
     */
    generateSupremeId() {
        const prefix = 'SPRM';
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `${prefix}-${timestamp}-${random}`;
    }

    /**
     * Get identity by Supreme ID
     */
    async getIdentity(supremeId) {
        const identity = await UniversalIdentity.findOne({ supremeId });
        
        if (!identity) {
            throw new AppError('Identity not found', 404);
        }
        
        return this.sanitizeIdentity(identity);
    }

    /**
     * Get identity with full data (for AI personalization)
     */
    async getFullIdentity(supremeId) {
        const identity = await UniversalIdentity.findOne({ supremeId });
        
        if (!identity) {
            throw new AppError('Identity not found', 404);
        }
        
        return identity;
    }

    /**
     * Update AI memory
     */
    async updateAIMemory(supremeId, memoryData) {
        const identity = await UniversalIdentity.findOne({ supremeId });
        
        if (!identity) {
            throw new AppError('Identity not found', 404);
        }
        
        identity.aiMemory = {
            ...identity.aiMemory,
            ...memoryData
        };
        
        await identity.save();
        return identity.aiMemory;
    }

    /**
     * Add interaction to AI memory
     */
    async addInteraction(supremeId, module, action, context = {}) {
        const identity = await UniversalIdentity.findOne({ supremeId });
        
        if (!identity) return null;
        
        identity.aiMemory.interactionHistory.push({
            module,
            action,
            timestamp: new Date(),
            context
        });
        
        // Keep last 1000 interactions
        if (identity.aiMemory.interactionHistory.length > 1000) {
            identity.aiMemory.interactionHistory = 
                identity.aiMemory.interactionHistory.slice(-1000);
        }
        
        await identity.save();
        return identity;
    }

    /**
     * Sanitize identity for public API
     */
    sanitizeIdentity(identity) {
        const obj = identity.toJSON();
        
        // Remove sensitive data
        delete obj.identities;
        delete obj.__v;
        
        return {
            ...obj,
            primaryEmail: identity.primaryEmail,
            connectedProviders: identity.connectedProviders,
            totalConnectedServices: identity.connectedServices.length
        };
    }

    /**
     * Delete identity (GDPR compliant)
     */
    async deleteIdentity(supremeId) {
        const identity = await UniversalIdentity.findOne({ supremeId });
        
        if (!identity) {
            throw new AppError('Identity not found', 404);
        }
        
        // Anonymize instead of delete
        identity.displayName = 'Deleted User';
        identity.unifiedProfile.emails = [];
        identity.unifiedProfile.phoneNumbers = [];
        identity.identities = [];
        identity.connectedServices = [];
        identity.aiMemory = { interactionHistory: [] };
        identity.status = 'deleted';
        
        await identity.save();
        
        return { message: 'Identity deleted successfully' };
    }
}

module.exports = new UniversalLoginService();
