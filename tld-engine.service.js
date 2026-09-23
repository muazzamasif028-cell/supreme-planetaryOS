// ============================================================
// 🌍 services/tld-engine.service.js
// SUPREME Universal TLD Engine v14.0
// Auto-discovers and manages all TLDs
// ============================================================
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class TLDEngine {
    constructor() {
        this.tlds = new Map();
        this.categories = new Map();
        this.lastSync = null;
        this.ianaURL = 'https://data.iana.org/TLD/tlds-alpha-by-domain.txt';
        
        this.loadTLDs();
    }

    /**
     * Load TLDs from local database
     */
    loadTLDs() {
        try {
            const tldData = require('./tlds.json');
            
            for (const [category, data] of Object.entries(tldData.categories)) {
                this.categories.set(category, {
                    name: data.name,
                    count: data.tlds.length
                });
                
                for (const tld of data.tlds) {
                    this.tlds.set(tld.tld.toLowerCase(), {
                        ...tld,
                        category,
                        addedAt: new Date().toISOString(),
                        status: 'active'
                    });
                }
            }
            
            console.log(`🌍 TLD Engine loaded: ${this.tlds.size} TLDs across ${this.categories.size} categories`);
        } catch (error) {
            console.error('Failed to load TLDs:', error.message);
        }
    }

    /**
     * Sync TLDs from IANA (auto-discover new TLDs)
     */
    async syncFromIANA() {
        try {
            console.log('🔄 Syncing TLDs from IANA...');
            
            const response = await axios.get(this.ianaURL);
            const lines = response.data.split('\n');
            
            let newTLDs = 0;
            
            for (const line of lines) {
                const tld = line.trim().toLowerCase();
                
                // Skip comments and empty lines
                if (!tld || tld.startsWith('#')) continue;
                
                // Add if not already in database
                if (!this.tlds.has(tld)) {
                    this.tlds.set(tld, {
                        tld,
                        name: `.${tld} domain`,
                        registry: 'IANA',
                        category: 'discovered',
                        quantumEligible: false,
                        discoveredAt: new Date().toISOString(),
                        status: 'discovered'
                    });
                    newTLDs++;
                }
            }
            
            this.lastSync = new Date().toISOString();
            
            console.log(`✅ TLD sync complete: ${newTLDs} new TLDs discovered`);
            
            return {
                totalTLDs: this.tlds.size,
                newTLDs,
                lastSync: this.lastSync
            };
            
        } catch (error) {
            console.error('TLD sync failed:', error.message);
            throw error;
        }
    }

    /**
     * Search TLDs
     */
    searchTLDs(query = '', filters = {}) {
        const { category, quantumEligible, premium } = filters;
        
        let results = Array.from(this.tlds.values());
        
        // Search by query
        if (query) {
            const q = query.toLowerCase();
            results = results.filter(tld => 
                tld.tld.includes(q) || 
                tld.name?.toLowerCase().includes(q) ||
                tld.country?.toLowerCase().includes(q)
            );
        }
        
        // Filter by category
        if (category) {
            results = results.filter(tld => tld.category === category);
        }
        
        // Filter by quantum eligibility
        if (quantumEligible !== undefined) {
            results = results.filter(tld => tld.quantumEligible === quantumEligible);
        }
        
        // Filter by premium
        if (premium !== undefined) {
            results = results.filter(tld => tld.premium === premium);
        }
        
        return {
            query,
            filters,
            total: results.length,
            results: results.slice(0, 100) // Limit to 100
        };
    }

    /**
     * Get TLD details
     */
    getTLD(tld) {
        return this.tlds.get(tld.toLowerCase()) || null;
    }

    /**
     * Get all categories
     */
    getCategories() {
        return Array.from(this.categories.entries()).map(([id, data]) => ({
            id,
            name: data.name,
            tldCount: data.count
        }));
    }

    /**
     * Get popular TLDs
     */
    getPopularTLDs(limit = 20) {
        const popular = ['com', 'net', 'org', 'io', 'ai', 'co', 'app', 'dev', 'cloud', 'tech',
                        'xyz', 'online', 'site', 'shop', 'store', 'blog', 'us', 'uk', 'de', 'fr'];
        
        return popular
            .map(tld => this.tlds.get(tld))
            .filter(Boolean)
            .slice(0, limit);
    }

    /**
     * Get country TLDs
     */
    getCountryTLDs() {
        return Array.from(this.tlds.values())
            .filter(tld => tld.category === 'country')
            .sort((a, b) => (a.country || '').localeCompare(b.country || ''));
    }

    /**
     * Add custom TLD
     */
    addCustomTLD(tldData) {
        const tld = tldData.tld.toLowerCase();
        
        if (this.tlds.has(tld)) {
            throw new Error(`TLD .${tld} already exists`);
        }
        
        this.tlds.set(tld, {
            ...tldData,
            tld,
            category: 'custom',
            addedAt: new Date().toISOString(),
            status: 'custom'
        });
        
        return this.tlds.get(tld);
    }

    /**
     * Check if TLD is supported
     */
    isSupported(tld) {
        return this.tlds.has(tld.toLowerCase());
    }

    /**
     * Get TLD statistics
     */
    getStats() {
        const stats = {
            total: this.tlds.size,
            byCategory: {},
            quantumEligible: 0,
            premium: 0,
            countryTLDs: 0,
            lastSync: this.lastSync
        };
        
        for (const tld of this.tlds.values()) {
            stats.byCategory[tld.category] = (stats.byCategory[tld.category] || 0) + 1;
            if (tld.quantumEligible) stats.quantumEligible++;
            if (tld.premium) stats.premium++;
            if (tld.category === 'country') stats.countryTLDs++;
        }
        
        return stats;
    }
}

// Singleton
const tldEngine = new TLDEngine();

module.exports = tldEngine;
