'use strict';

const client = require('prom-client');

client.collectDefaultMetrics();

class TelemetryMetrics {
    constructor() {
        this.startedAt = Date.now();

        this.counters = {
            ingested: 0,
            rejected: 0,
            anomalies: 0,
            persisted: 0,
            published: 0
        };

        this.lastEventAt = null;

        this.promCounters = {
            ingested: new client.Counter({
                name: 'neom_telemetry_ingested_total',
                help: 'Total NEOM telemetry events ingested'
            }),
            rejected: new client.Counter({
                name: 'neom_telemetry_rejected_total',
                help: 'Total NEOM telemetry events rejected'
            }),
            anomalies: new client.Counter({
                name: 'neom_telemetry_anomalies_total',
                help: 'Total NEOM telemetry anomalies detected'
            }),
            persisted: new client.Counter({
                name: 'neom_telemetry_persisted_total',
                help: 'Total NEOM telemetry events persisted'
            }),
            published: new client.Counter({
                name: 'neom_telemetry_published_total',
                help: 'Total NEOM telemetry events published'
            })
        };

        this.lastEventGauge = new client.Gauge({
            name: 'neom_telemetry_last_event_timestamp_seconds',
            help: 'Unix timestamp of the latest NEOM telemetry event'
        });
    }

    increment(name) {
        if (
            Object.prototype.hasOwnProperty.call(
                this.counters,
                name
            )
        ) {
            this.counters[name]++;
        }

        if (
            this.promCounters &&
            this.promCounters[name]
        ) {
            this.promCounters[name].inc();
        }
    }

    recordEvent(timestamp) {
        this.lastEventAt = timestamp;

        const time = new Date(timestamp).getTime();

        if (Number.isFinite(time)) {
            this.lastEventGauge.set(
                Math.floor(time / 1000)
            );
        }
    }

    snapshot() {
        return {
            ...this.counters,
            uptimeSeconds:
                Math.floor(
                    (Date.now() - this.startedAt) / 1000
                ),
            lastEventAt: this.lastEventAt
        };
    }

    async metrics() {
        return client.register.metrics();
    }

    contentType() {
        return client.register.contentType;
    }
}

module.exports = new TelemetryMetrics();
