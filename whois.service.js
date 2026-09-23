'use strict';

const RDAP_BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';

class WhoisService {
    constructor() {
        this.bootstrapCache = null;
        this.bootstrapLoadedAt = 0;
        this.bootstrapTtlMs = 24 * 60 * 60 * 1000;
    }

    async getBootstrap() {
        const now = Date.now();

        if (
            this.bootstrapCache &&
            now - this.bootstrapLoadedAt < this.bootstrapTtlMs
        ) {
            return this.bootstrapCache;
        }

        const response = await fetch(RDAP_BOOTSTRAP_URL, {
            headers: {
                accept: 'application/rdap+json, application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`RDAP bootstrap request failed: ${response.status}`);
        }

        this.bootstrapCache = await response.json();
        this.bootstrapLoadedAt = now;

        return this.bootstrapCache;
    }

    normalizeDomain(domain) {
        if (typeof domain !== 'string' || !domain.trim()) {
            throw new Error('Domain is required');
        }

        return domain.trim().toLowerCase().replace(/\.+$/, '');
    }

    getTld(domain) {
        const parts = domain.split('.');

        if (parts.length < 2) {
            throw new Error('Invalid domain');
        }

        return parts[parts.length - 1];
    }

    async findRdapBaseUrl(tld) {
        const bootstrap = await this.getBootstrap();
        const target = tld.toLowerCase();

        for (const service of bootstrap.services || []) {
            const tlds = service[0] || [];
            const urls = service[1] || [];

            if (tlds.some(item => item.toLowerCase() === target)) {
                return urls[0] || null;
            }
        }

        return null;
    }

    async queryWhoisServer(host, domain, port = 43) {
        const net = require('net');

        return new Promise((resolve, reject) => {
            const socket = net.createConnection({ host, port });
            let data = '';

            const cleanup = () => {
                socket.removeAllListeners();
            };

            socket.setTimeout(10000);

            socket.on('connect', () => {
                socket.write(domain + '\r\n');
            });

            socket.on('data', chunk => {
                data += chunk.toString();
            });

            socket.on('end', () => {
                cleanup();
                resolve(data);
            });

            socket.on('timeout', () => {
                cleanup();
                socket.destroy();
                reject(new Error(`WHOIS timeout: ${host}`));
            });

            socket.on('error', error => {
                cleanup();
                reject(error);
            });
        });
    }

    parsePkWhois(domain, response) {
        const lines = String(response)
            .split(/\r?\n/)
            .map(line => line.trim());

        const registered = lines.some(
            line => /^Status:\s*Domain is Registered$/i.test(line)
        );

        const creationLine = lines.find(
            line => /^Creation Date:/i.test(line)
        );

        const expiryLine = lines.find(
            line => /^Expiry Date:/i.test(line)
        );

        const creationDate = creationLine
            ? creationLine.replace(/^Creation Date:\s*/i, '').trim()
            : null;

        const expiryDate = expiryLine
            ? expiryLine.replace(/^Expiry Date:\s*/i, '').trim()
            : null;

        return {
            domain,
            tld: 'pk',
            available: !registered,
            registrar: 'PKNIC',
            creationDate,
            expiryDate,
            status: registered ? 'REGISTERED' : 'AVAILABLE',
            source: 'pknic-whois'
        };
    }
    async lookup(domain) {
        const normalizedDomain = this.normalizeDomain(domain);
        const tld = this.getTld(normalizedDomain);
        const rdapBaseUrl = await this.findRdapBaseUrl(tld);

        if (!rdapBaseUrl) {
            if (tld === 'pk') {
                try {
                    const raw = await this.queryWhoisServer(
                        'whois.pknic.net.pk',
                        normalizedDomain
                    );

                    return this.parsePkWhois(normalizedDomain, raw);
                } catch (error) {
                    return {
                        domain: normalizedDomain,
                        tld,
                        available: null,
                        registrar: null,
                        creationDate: null,
                        expiryDate: null,
                        status: 'WHOIS_UNAVAILABLE',
                        source: 'pknic-whois'
                    };
                }
            }

            return {
                domain: normalizedDomain,
                tld,
                available: null,
                registrar: null,
                creationDate: null,
                expiryDate: null,
                status: 'RDAP_UNAVAILABLE',
                source: 'iana-bootstrap'
            };
        }

        const base = rdapBaseUrl.endsWith('/')
            ? rdapBaseUrl
            : `${rdapBaseUrl}/`;

        const lookupUrl =
            `${base}domain/${encodeURIComponent(normalizedDomain)}`;

        const response = await fetch(lookupUrl, {
            headers: {
                accept: 'application/rdap+json, application/json'
            }
        });

        if (response.status === 404) {
            return {
                domain: normalizedDomain,
                tld,
                available: true,
                registrar: null,
                creationDate: null,
                expiryDate: null,
                status: 'AVAILABLE',
                source: 'rdap'
            };
        }

        if (!response.ok) {
            return {
                domain: normalizedDomain,
                tld,
                available: null,
                registrar: null,
                creationDate: null,
                expiryDate: null,
                status: `RDAP_HTTP_${response.status}`,
                source: 'rdap'
            };
        }

        const data = await response.json();

        const registrarEntity = (data.entities || []).find(entity =>
            Array.isArray(entity.roles) && entity.roles.includes('registrar')
        );

        const registrarName =
            registrarEntity?.vcardArray?.[1]?.find(item => item[0] === 'fn')?.[3] ||
            null;

        const events = Array.isArray(data.events) ? data.events : [];

        const creationEvent =
            events.find(event => event.eventAction === 'registration');

        const expiryEvent =
            events.find(event => event.eventAction === 'expiration');

        return {
            domain: normalizedDomain,
            tld,
            available: false,
            registrar: registrarName,
            creationDate: creationEvent?.eventDate || null,
            expiryDate: expiryEvent?.eventDate || null,
            status: 'REGISTERED',
            source: 'rdap',
            raw: data
        };
    }
}

module.exports = new WhoisService();
