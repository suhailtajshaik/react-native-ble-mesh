'use strict';

const { NetworkMonitor, HEALTH_STATUS } = require('../../src/mesh/monitor');

describe('NetworkMonitor', () => {
    let monitor;

    beforeEach(() => {
        monitor = new NetworkMonitor({
            healthCheckIntervalMs: 60 * 60 * 1000, // Disable auto-checks for tests
            nodeTimeoutMs: 60 * 1000,
        });
    });

    afterEach(() => {
        monitor.destroy();
    });

    describe('constructor', () => {
        it('creates instance with default config', () => {
            const m = new NetworkMonitor();
            expect(m).toBeDefined();
            m.destroy();
        });
    });

    describe('trackMessageSent()', () => {
        it('tracks outgoing message', () => {
            monitor.trackMessageSent('peer-1', 'msg-1');

            const stats = monitor.getStats();
            expect(stats.totalMessagesSent).toBe(1);
        });

        it('creates node entry on first message', () => {
            monitor.trackMessageSent('peer-1', 'msg-1');

            const nodeHealth = monitor.getNodeHealth('peer-1');
            expect(nodeHealth).toBeDefined();
            expect(nodeHealth.messagesSent).toBe(1);
        });
    });

    describe('trackMessageDelivered()', () => {
        it('tracks delivery with latency', () => {
            monitor.trackMessageSent('peer-1', 'msg-1');
            monitor.trackMessageDelivered('msg-1', 50);

            const stats = monitor.getStats();
            expect(stats.totalMessagesDelivered).toBe(1);
        });

        it('calculates latency automatically if not provided', async () => {
            monitor.trackMessageSent('peer-1', 'msg-1');

            // Wait a bit
            await new Promise(r => setTimeout(r, 10));

            monitor.trackMessageDelivered('msg-1');

            const stats = monitor.getStats();
            expect(stats.averageLatency).toBeGreaterThan(0);
        });

        it('ignores unknown message IDs', () => {
            monitor.trackMessageDelivered('unknown-msg');

            const stats = monitor.getStats();
            expect(stats.totalMessagesDelivered).toBe(0);
        });
    });

    describe('trackMessageFailed()', () => {
        it('tracks failed delivery', () => {
            monitor.trackMessageSent('peer-1', 'msg-1');
            monitor.trackMessageFailed('msg-1');

            const stats = monitor.getStats();
            expect(stats.totalMessagesFailed).toBe(1);
        });
    });

    describe('trackMessageReceived()', () => {
        it('tracks incoming messages', () => {
            monitor.trackMessageReceived('peer-1');
            monitor.trackMessageReceived('peer-1');

            const stats = monitor.getStats();
            expect(stats.totalMessagesReceived).toBe(2);

            const nodeHealth = monitor.getNodeHealth('peer-1');
            expect(nodeHealth.messagesReceived).toBe(2);
        });
    });

    describe('trackPeerDiscovered()', () => {
        it('creates node entry', () => {
            monitor.trackPeerDiscovered('peer-1');

            const nodeHealth = monitor.getNodeHealth('peer-1');
            expect(nodeHealth).toBeDefined();
            expect(nodeHealth.peerId).toBe('peer-1');
        });
    });

    describe('trackPeerDisconnected()', () => {
        it('tracks disconnection event', () => {
            monitor.trackPeerDiscovered('peer-1');
            monitor.trackPeerDisconnected('peer-1');

            // The node is tracked but marked with disconnectedAt
            const nodeHealth = monitor.getNodeHealth('peer-1');
            expect(nodeHealth).toBeDefined();
            expect(nodeHealth.disconnectedAt).toBeDefined();
        });
    });

    describe('generateHealthReport()', () => {
        it('returns health report', () => {
            const report = monitor.generateHealthReport();

            expect(report).toHaveProperty('activeNodes');
            expect(report).toHaveProperty('totalKnownNodes');
            expect(report).toHaveProperty('averageLatencyMs');
            expect(report).toHaveProperty('packetLossRate');
            expect(report).toHaveProperty('overallHealth');
            expect(report).toHaveProperty('lastUpdated');
        });

        it('counts active nodes correctly', () => {
            // In this implementation, active is based on lastSeen timeout
            // Both nodes were recently discovered, so both are active
            monitor.trackPeerDiscovered('peer-1');
            monitor.trackPeerDiscovered('peer-2');

            const report = monitor.generateHealthReport();

            expect(report.totalKnownNodes).toBe(2);
            // Both are active since they were recently discovered
            expect(report.activeNodes).toBe(2);
        });

        it('calculates packet loss rate', () => {
            monitor.trackMessageSent('peer-1', 'msg-1');
            monitor.trackMessageSent('peer-1', 'msg-2');
            monitor.trackMessageSent('peer-1', 'msg-3');
            monitor.trackMessageSent('peer-1', 'msg-4');
            monitor.trackMessageDelivered('msg-1', 50);
            monitor.trackMessageDelivered('msg-2', 50);
            monitor.trackMessageFailed('msg-3');
            monitor.trackMessageFailed('msg-4');

            const report = monitor.generateHealthReport();

            expect(report.packetLossRate).toBeGreaterThan(0);
        });

        it('assesses health as POOR when no active nodes', () => {
            const report = monitor.generateHealthReport();
            expect(report.overallHealth).toBe(HEALTH_STATUS.POOR);
        });

        it('assesses health as GOOD with healthy network', () => {
            // Add several active peers
            for (let i = 0; i < 5; i++) {
                monitor.trackPeerDiscovered(`peer-${i}`);
                monitor.trackMessageSent(`peer-${i}`, `msg-${i}`);
                monitor.trackMessageDelivered(`msg-${i}`, 100);
            }

            const report = monitor.generateHealthReport();
            expect(report.overallHealth).toBe(HEALTH_STATUS.GOOD);
        });
    });

    describe('getNodeHealth()', () => {
        it('returns null for unknown node', () => {
            expect(monitor.getNodeHealth('unknown')).toBeNull();
        });

        it('returns node health info', () => {
            monitor.trackPeerDiscovered('peer-1');
            monitor.trackMessageReceived('peer-1');

            const health = monitor.getNodeHealth('peer-1');

            expect(health.peerId).toBe('peer-1');
            expect(health.messagesReceived).toBe(1);
            expect(health.isActive).toBe(true);
        });
    });

    describe('getAllNodeHealth()', () => {
        it('returns all nodes', () => {
            monitor.trackPeerDiscovered('peer-1');
            monitor.trackPeerDiscovered('peer-2');

            const all = monitor.getAllNodeHealth();

            expect(all).toHaveLength(2);
        });
    });

    describe('getStats()', () => {
        it('returns statistics', () => {
            const stats = monitor.getStats();

            expect(stats).toHaveProperty('totalMessagesSent');
            expect(stats).toHaveProperty('totalMessagesDelivered');
            expect(stats).toHaveProperty('totalMessagesFailed');
            expect(stats).toHaveProperty('totalMessagesReceived');
            expect(stats).toHaveProperty('knownNodes');
            expect(stats).toHaveProperty('pendingMessages');
        });
    });

    describe('reset()', () => {
        it('clears all monitoring data', () => {
            monitor.trackPeerDiscovered('peer-1');
            monitor.trackMessageReceived('peer-1');

            monitor.reset();

            const stats = monitor.getStats();
            expect(stats.knownNodes).toBe(0);
            expect(stats.totalMessagesReceived).toBe(0);
        });
    });

    describe('events', () => {
        it('emits health-changed event', () => {
            const handler = jest.fn();
            monitor.on('health-changed', handler);

            // Generate health change
            for (let i = 0; i < 5; i++) {
                monitor.trackPeerDiscovered(`peer-${i}`);
            }
            monitor.generateHealthReport();

            expect(handler).toHaveBeenCalled();
        });
    });
});
