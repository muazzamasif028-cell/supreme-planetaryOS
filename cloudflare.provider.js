// ============================================================
// 🔌 providers/cloudflare.provider.js
// SUPREME Cloudflare Registrar Provider v11.0
// ============================================================
const axios = require('axios');

class CloudflareProvider {
    constructor() {
        this.baseURL = 'https://api.cloudflare.com/client/v4';
        this.apiToken = process.env.CLOUDFLARE_API_TOKEN;
        this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    }

    getHeaders() {
        return {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Check domain availability
     */
    async checkAvailability(domain, tld) {
        try {
            const response = await axios.get(
                `${this.baseURL}/accounts/${this.accountId}/registrar/domains/${domain}.${tld}`,
                { headers: this.getHeaders() }
            );
            
            return {
                available: response.data.result?.available || false,
                premium: response.data.result?.premium || false,
                price: response.data.result?.price || null
            };
        } catch (error) {
            if (error.response?.status === 404) {
                return { available: true, premium: false, price: null };
            }
            throw error;
        }
    }

    /**
     * Register domain
     */
    async register(data) {
        const { domain, tld, whoisInfo, autoRenew } = data;
        
        const response = await axios.post(
            `${this.baseURL}/accounts/${this.accountId}/registrar/domains/${domain}.${tld}/registration`,
            {
                auto_renew: autoRenew,
                privacy: true,
                registrant_contact: {
                    first_name: whoisInfo?.firstName || 'Domain',
                    last_name: whoisInfo?.lastName || 'Owner',
                    email: whoisInfo?.email || 'owner@supreme-os.com',
                    phone: whoisInfo?.phone || '+1.5555555555',
                    address: whoisInfo?.address || '123 Main St',
                    city: whoisInfo?.city || 'San Francisco',
                    state: whoisInfo?.state || 'CA',
                    zip: whoisInfo?.zipCode || '94105',
                    country: whoisInfo?.country || 'US'
                }
            },
            { headers: this.getHeaders() }
        );
        
        return {
            id: response.data.result?.id,
            status: 'registered',
            provider: 'cloudflare'
        };
    }

    /**
     * Initiate domain transfer
     */
    async initiateTransfer(data) {
        const { domain, tld, authCode } = data;
        
        const response = await axios.post(
            `${this.baseURL}/accounts/${this.accountId}/registrar/domains/${domain}.${tld}/transfer`,
            { auth_code: authCode },
            { headers: this.getHeaders() }
        );
        
        return {
            id: response.data.result?.id,
            status: 'transferring',
            provider: 'cloudflare'
        };
    }

    /**
     * Renew domain
     */
    async renew(data) {
        const { domain, tld, years } = data;
        
        const response = await axios.post(
            `${this.baseURL}/accounts/${this.accountId}/registrar/domains/${domain}.${tld}/renew`,
            { years },
            { headers: this.getHeaders() }
        );
        
        return {
            success: true,
            price: response.data.result?.price,
            newExpiryDate: response.data.result?.expires_at
        };
    }

    /**
     * Release/delete domain
     */
    async release(data) {
        const { registrarId } = data;
        
        await axios.delete(
            `${this.baseURL}/accounts/${this.accountId}/registrar/domains/${registrarId}`,
            { headers: this.getHeaders() }
        );
        
        return { success: true };
    }
}

module.exports = new CloudflareProvider();
