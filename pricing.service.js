// ============================================================
// 💰 services/pricing.service.js
// SUPREME Enterprise Domain Pricing Service v14.0
// ============================================================
const pricingData = require('./pricing-tiers.json');

class PricingService {
    constructor() {
        this.pricing = pricingData;
        this.currency = pricingData.currency;
    }

    /**
     * Calculate total price for domain registration
     */
    calculatePrice(domain, tld, quantumTier = 'standard', years = 1, options = {}) {
        const basePrice = this.getBasePrice(tld, 'register');
        const quantumPrice = this.getQuantumPrice(quantumTier);
        
        const subtotal = (basePrice + quantumPrice) * years;
        const discount = this.calculateDiscount(years, quantumTier, options);
        const tax = this.calculateTax(subtotal, options.country);
        const total = subtotal - discount + tax;
        
        return {
            domain: `${domain}.${tld}`,
            tld,
            quantumTier,
            years,
            breakdown: {
                basePrice: basePrice * years,
                quantumPrice: quantumPrice * years,
                subtotal,
                discount,
                tax,
                total
            },
            currency: this.currency,
            savings: discount > 0 ? `${((discount / subtotal) * 100).toFixed(0)}%` : '0%'
        };
    }

    /**
     * Get base price for TLD
     */
    getBasePrice(tld, action = 'register') {
        // Check generic TLDs
        if (this.pricing.basePricing.generic[tld]) {
            return this.pricing.basePricing.generic[tld][action] || 14.99;
        }
        
        // Check country TLDs
        if (this.pricing.basePricing.country[tld]) {
            return this.pricing.basePricing.country[tld][action] || 14.99;
        }
        
        // Default pricing
        return 14.99;
    }

    /**
     * Get quantum layer price
     */
    getQuantumPrice(tier) {
        const quantumTier = this.pricing.quantumLayers[tier];
        return quantumTier ? quantumTier.price : 0;
    }

    /**
     * Calculate discount
     */
    calculateDiscount(years, tier, options = {}) {
        let discount = 0;
        
        // Multi-year discount
        if (years >= 10) discount += 0.20; // 20% off for 10 years
        else if (years >= 5) discount += 0.10; // 10% off for 5 years
        else if (years >= 3) discount += 0.05; // 5% off for 3 years
        
        // Enterprise tier discount
        if (['quantum', 'sovereign', 'planetary', 'galactic'].includes(tier)) {
            discount += 0.05; // Additional 5% for enterprise tiers
        }
        
        // Promo code
        if (options.promoCode === 'SUPREME20') discount += 0.20;
        if (options.promoCode === 'QUANTUM10') discount += 0.10;
        
        // Calculate discount amount
        const basePrice = this.getBasePrice(options.tld || 'com');
        const quantumPrice = this.getQuantumPrice(tier);
        const subtotal = (basePrice + quantumPrice) * years;
        
        return subtotal * Math.min(discount, 0.30); // Max 30% discount
    }

    /**
     * Calculate tax based on country
     */
    calculateTax(subtotal, country = 'US') {
        const taxRates = {
            US: 0.00, // No tax on domains in US
            UK: 0.20, // 20% VAT
            EU: 0.21, // 21% VAT
            IN: 0.18, // 18% GST
            AU: 0.10, // 10% GST
            PK: 0.00, // No tax
            AE: 0.05, // 5% VAT
            SA: 0.15  // 15% VAT
        };
        
        const rate = taxRates[country] || 0;
        return subtotal * rate;
    }

    /**
     * Get all quantum tiers with pricing
     */
    getQuantumTiers() {
        return Object.entries(this.pricing.quantumLayers).map(([id, tier]) => ({
            id,
            name: tier.name,
            layers: tier.layers,
            price: tier.price,
            pricePerLayer: tier.layers > 0 ? (tier.price / tier.layers).toFixed(2) : 0,
            features: tier.features
        }));
    }

    /**
     * Get enterprise quote (custom pricing)
     */
    getEnterpriseQuote(requirements) {
        const {
            domains = 1,
            tlds = ['com'],
            quantumTier = 'quantum',
            years = 1,
            customFeatures = []
        } = requirements;
        
        let basePrice = 0;
        
        // Calculate for each domain/TLD
        for (const tld of tlds) {
            const domainPrice = this.calculatePrice('example', tld, quantumTier, years);
            basePrice += domainPrice.breakdown.total;
        }
        
        // Volume discount
        let volumeDiscount = 0;
        if (domains >= 1000) volumeDiscount = 0.40;
        else if (domains >= 100) volumeDiscount = 0.25;
        else if (domains >= 10) volumeDiscount = 0.10;
        
        const totalBeforeDiscount = basePrice * domains;
        const totalAfterDiscount = totalBeforeDiscount * (1 - volumeDiscount);
        
        return {
            requirements,
            quote: {
                domains,
                tlds,
                quantumTier,
                years,
                basePricePerDomain: basePrice,
                totalBeforeDiscount,
                volumeDiscount: `${(volumeDiscount * 100).toFixed(0)}%`,
                totalAfterDiscount,
                annualPrice: totalAfterDiscount / years,
                currency: this.currency,
                validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            }
        };
    }

    /**
     * Compare tiers
     */
    compareTiers() {
        return this.getQuantumTiers().map(tier => ({
            ...tier,
            savings: tier.layers > 0 
                ? `${((1 - tier.price / tier.layers / 10) * 100).toFixed(0)}%` 
                : '0%',
            roi: tier.layers > 0 
                ? `${(tier.features.length / tier.price * 100).toFixed(0)}x` 
                : 'N/A'
        }));
    }
}

module.exports = new PricingService();
