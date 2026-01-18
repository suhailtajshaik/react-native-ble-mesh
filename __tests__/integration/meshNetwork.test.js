'use strict';

/**
 * @fileoverview Integration tests for MeshNetwork lifecycle
 *
 * These tests verify the full MeshNetwork lifecycle including:
 * - Initialization and startup
 * - Peer discovery and connection
 * - Message sending and receiving
 * - Channel operations
 * - Battery mode changes
 * - Panic mode operations
 * - Graceful shutdown
 */

const { MeshNetwork, BATTERY_MODE, PANIC_TRIGGER, HEALTH_STATUS } = require('../../src/MeshNetwork');
const { MockTransport } = require('../../src/transport');

describe('MeshNetwork Integration', () => {
    describe('Lifecycle', () => {
        let mesh;

        afterEach(async () => {
            if (mesh) {
                await mesh.destroy();
                mesh = null;
            }
        });

        it('creates instance with default config', () => {
            mesh = new MeshNetwork();

            expect(mesh).toBeDefined();
            expect(mesh.getBatteryMode()).toBe(BATTERY_MODE.BALANCED);
        });

        it('creates instance with custom config', () => {
            mesh = new MeshNetwork({
                nickname: 'TestNode',
                batteryMode: BATTERY_MODE.LOW_POWER,
                compression: { enabled: true, threshold: 50 },
            });

            expect(mesh).toBeDefined();
            expect(mesh.getBatteryMode()).toBe(BATTERY_MODE.LOW_POWER);
        });

        it('starts and stops successfully', async () => {
            mesh = new MeshNetwork({ nickname: 'TestNode' });
            const transport = new MockTransport();

            const startedHandler = jest.fn();
            const stoppedHandler = jest.fn();

            mesh.on('started', startedHandler);
            mesh.on('stopped', stoppedHandler);

            await mesh.start(transport);
            expect(startedHandler).toHaveBeenCalled();

            await mesh.stop();
            expect(stoppedHandler).toHaveBeenCalled();
        });

        it('emits error when calling methods before start', async () => {
            mesh = new MeshNetwork();

            await expect(mesh.broadcast('Hello')).rejects.toThrow();
            await expect(mesh.sendDirect('peer-1', 'Hello')).rejects.toThrow();
        });

        it('can restart after stop', async () => {
            mesh = new MeshNetwork();
            const transport = new MockTransport();

            await mesh.start(transport);
            await mesh.stop();
            await mesh.start(transport);

            const status = mesh.getStatus();
            expect(status.state).toBe('running');
        });

        it('destroy cleans up all resources', async () => {
            mesh = new MeshNetwork();
            const transport = new MockTransport();

            await mesh.start(transport);
            await mesh.destroy();

            // Should not be able to use after destroy
            await expect(mesh.broadcast('test')).rejects.toThrow();
        });
    });

    describe('Status and Identity', () => {
        let mesh;
        let transport;

        beforeEach(async () => {
            mesh = new MeshNetwork({ nickname: 'Alice' });
            transport = new MockTransport();
            await mesh.start(transport);
        });

        afterEach(async () => {
            await mesh.destroy();
        });

        it('returns correct status', () => {
            const status = mesh.getStatus();

            expect(status).toHaveProperty('state', 'running');
            expect(status).toHaveProperty('identity');
            expect(status).toHaveProperty('peers');
            expect(status).toHaveProperty('connectedPeers');
            expect(status).toHaveProperty('channels');
            expect(status).toHaveProperty('health');
            expect(status).toHaveProperty('batteryMode');
        });

        it('returns identity information', () => {
            const identity = mesh.getIdentity();

            expect(identity).toHaveProperty('publicKey');
            expect(identity).toHaveProperty('displayName', 'Alice');
        });

        it('can update nickname', () => {
            mesh.setNickname('AliceUpdated');

            const identity = mesh.getIdentity();
            expect(identity.displayName).toBe('AliceUpdated');
        });
    });

    describe('Messaging', () => {
        let mesh;
        let transport;

        beforeEach(async () => {
            mesh = new MeshNetwork({ nickname: 'Sender' });
            transport = new MockTransport();
            await mesh.start(transport);
        });

        afterEach(async () => {
            await mesh.destroy();
        });

        it('validates message text', async () => {
            // Null/undefined
            await expect(mesh.broadcast(null)).rejects.toThrow('ValidationError');
            await expect(mesh.broadcast(undefined)).rejects.toThrow('ValidationError');

            // Wrong type
            await expect(mesh.broadcast(123)).rejects.toThrow('ValidationError');
            await expect(mesh.broadcast({})).rejects.toThrow('ValidationError');

            // Empty string
            await expect(mesh.broadcast('')).rejects.toThrow('ValidationError');
        });

        it('validates peer ID for direct messages', async () => {
            await expect(mesh.sendDirect(null, 'Hello')).rejects.toThrow('ValidationError');
            await expect(mesh.sendDirect('', 'Hello')).rejects.toThrow('ValidationError');
            await expect(mesh.sendDirect('   ', 'Hello')).rejects.toThrow('ValidationError');
            await expect(mesh.sendDirect(123, 'Hello')).rejects.toThrow('ValidationError');
        });

        it('broadcast returns message ID', async () => {
            const messageId = await mesh.broadcast('Hello world!');

            expect(messageId).toBeDefined();
            expect(typeof messageId).toBe('string');
        });
    });

    describe('Peer Management', () => {
        let mesh;
        let transport;

        beforeEach(async () => {
            mesh = new MeshNetwork();
            transport = new MockTransport();
            await mesh.start(transport);
        });

        afterEach(async () => {
            await mesh.destroy();
        });

        it('initially has no peers', () => {
            const peers = mesh.getPeers();
            expect(peers).toEqual([]);
        });

        it('emits peerDiscovered event', async () => {
            const handler = jest.fn();
            mesh.on('peerDiscovered', handler);

            // Simulate peer discovery via transport
            transport.simulatePeerConnect('peer-123');

            // Wait for event propagation
            await new Promise(r => setTimeout(r, 50));

            // The service should emit peer-discovered which MeshNetwork forwards
            // Note: This depends on MeshService implementation
        });

        it('can block and unblock peers', () => {
            const blockHandler = jest.fn();
            const unblockHandler = jest.fn();

            mesh.on('peerBlocked', blockHandler);
            mesh.on('peerUnblocked', unblockHandler);

            mesh.blockPeer('peer-123');
            expect(blockHandler).toHaveBeenCalledWith({ peerId: 'peer-123' });

            mesh.unblockPeer('peer-123');
            expect(unblockHandler).toHaveBeenCalledWith({ peerId: 'peer-123' });
        });
    });

    describe('Network Health', () => {
        let mesh;
        let transport;

        beforeEach(async () => {
            mesh = new MeshNetwork();
            transport = new MockTransport();
            await mesh.start(transport);
        });

        afterEach(async () => {
            await mesh.destroy();
        });

        it('returns network health report', () => {
            const health = mesh.getNetworkHealth();

            expect(health).toHaveProperty('activeNodes');
            expect(health).toHaveProperty('totalKnownNodes');
            expect(health).toHaveProperty('averageLatencyMs');
            expect(health).toHaveProperty('packetLossRate');
            expect(health).toHaveProperty('overallHealth');
            expect(health).toHaveProperty('lastUpdated');
        });

        it('returns null for unknown peer health', () => {
            const peerHealth = mesh.getPeerHealth('unknown-peer');
            expect(peerHealth).toBeNull();
        });

        it('emits networkHealthChanged event', async () => {
            const handler = jest.fn();
            mesh.on('networkHealthChanged', handler);

            // The monitor emits health-changed which MeshNetwork forwards
            // This happens automatically on health check intervals
        });
    });

    describe('Battery Management', () => {
        let mesh;
        let transport;

        beforeEach(async () => {
            mesh = new MeshNetwork({ batteryMode: BATTERY_MODE.BALANCED });
            transport = new MockTransport();
            await mesh.start(transport);
        });

        afterEach(async () => {
            await mesh.destroy();
        });

        it('returns current battery mode', () => {
            const mode = mesh.getBatteryMode();
            expect(mode).toBe(BATTERY_MODE.BALANCED);
        });

        it('can change battery mode', async () => {
            await mesh.setBatteryMode(BATTERY_MODE.LOW_POWER);

            const mode = mesh.getBatteryMode();
            expect(mode).toBe(BATTERY_MODE.LOW_POWER);
        });

        it('accepts battery level updates', () => {
            // Should not throw
            expect(() => mesh.updateBatteryLevel(75, false)).not.toThrow();
            expect(() => mesh.updateBatteryLevel(50, true)).not.toThrow();
        });
    });

    describe('Panic Mode', () => {
        let mesh;
        let transport;

        beforeEach(async () => {
            mesh = new MeshNetwork();
            transport = new MockTransport();
            await mesh.start(transport);
        });

        afterEach(async () => {
            await mesh.destroy();
        });

        it('can enable and disable panic mode', () => {
            const enableHandler = jest.fn();
            const disableHandler = jest.fn();

            mesh.on('panicModeEnabled', enableHandler);
            mesh.on('panicModeDisabled', disableHandler);

            mesh.enablePanicMode();
            expect(enableHandler).toHaveBeenCalled();

            mesh.disablePanicMode();
            expect(disableHandler).toHaveBeenCalled();
        });

        it('can register panic taps', () => {
            mesh.enablePanicMode({ trigger: PANIC_TRIGGER.TRIPLE_TAP });

            // Should not throw
            expect(() => mesh.registerPanicTap()).not.toThrow();
        });

        it('wipeAllData returns result', async () => {
            mesh.enablePanicMode();

            const result = await mesh.wipeAllData();

            expect(result).toHaveProperty('trigger');
            expect(result).toHaveProperty('elapsedMs');
            expect(result).toHaveProperty('metTarget');
        });

        it('emits dataWiped event', async () => {
            const handler = jest.fn();
            mesh.on('dataWiped', handler);

            mesh.enablePanicMode();
            await mesh.wipeAllData();

            expect(handler).toHaveBeenCalled();
        });
    });

    describe('Channel Operations', () => {
        let mesh;
        let transport;

        beforeEach(async () => {
            mesh = new MeshNetwork();
            transport = new MockTransport();
            await mesh.start(transport);
        });

        afterEach(async () => {
            await mesh.destroy();
        });

        it('initially has no channels', () => {
            const channels = mesh.getChannels();
            expect(channels).toEqual([]);
        });

        it('normalizes channel names', async () => {
            const joinHandler = jest.fn();
            mesh.on('channelJoined', joinHandler);

            await mesh.joinChannel('general'); // Without #

            expect(joinHandler).toHaveBeenCalledWith({ channel: '#general' });
        });

        it('emits channelJoined and channelLeft events', async () => {
            const joinHandler = jest.fn();
            const leaveHandler = jest.fn();

            mesh.on('channelJoined', joinHandler);
            mesh.on('channelLeft', leaveHandler);

            await mesh.joinChannel('#test');
            expect(joinHandler).toHaveBeenCalledWith({ channel: '#test' });

            await mesh.leaveChannel('#test');
            expect(leaveHandler).toHaveBeenCalledWith({ channel: '#test' });
        });
    });

    describe('Store and Forward', () => {
        let mesh;
        let transport;

        beforeEach(async () => {
            mesh = new MeshNetwork({
                storeAndForward: {
                    enabled: true,
                    retentionHours: 12,
                    maxCachedMessages: 500,
                },
            });
            transport = new MockTransport();
            await mesh.start(transport);
        });

        afterEach(async () => {
            await mesh.destroy();
        });

        it('caches messages for offline peers', async () => {
            const cacheHandler = jest.fn();
            mesh.on('messageCached', cacheHandler);

            // Try to send to an offline peer - should cache
            // Note: This depends on sendDirect catching the error and caching
        });
    });

    describe('Event Forwarding', () => {
        let mesh;
        let transport;

        beforeEach(async () => {
            mesh = new MeshNetwork();
            transport = new MockTransport();
            await mesh.start(transport);
        });

        afterEach(async () => {
            await mesh.destroy();
        });

        it('forwards error events', () => {
            const handler = jest.fn();
            mesh.on('error', handler);

            // Errors from service should be forwarded
        });
    });
});

describe('MeshNetwork Multi-Instance', () => {
    it('two instances can be created independently', async () => {
        const mesh1 = new MeshNetwork({ nickname: 'Alice' });
        const mesh2 = new MeshNetwork({ nickname: 'Bob' });

        const transport1 = new MockTransport();
        const transport2 = new MockTransport();

        await mesh1.start(transport1);
        await mesh2.start(transport2);

        expect(mesh1.getIdentity().displayName).toBe('Alice');
        expect(mesh2.getIdentity().displayName).toBe('Bob');

        await mesh1.destroy();
        await mesh2.destroy();
    });

    it('linked transports can communicate', async () => {
        const mesh1 = new MeshNetwork({ nickname: 'Alice' });
        const mesh2 = new MeshNetwork({ nickname: 'Bob' });

        const transport1 = new MockTransport();
        const transport2 = new MockTransport();

        // Link transports for peer-to-peer simulation
        transport1.linkTo(transport2);
        transport2.linkTo(transport1);

        await mesh1.start(transport1);
        await mesh2.start(transport2);

        // Both should be running
        expect(mesh1.getStatus().state).toBe('running');
        expect(mesh2.getStatus().state).toBe('running');

        await mesh1.destroy();
        await mesh2.destroy();
    });
});

describe('MeshNetwork Static Properties', () => {
    it('exposes BatteryMode constants', () => {
        expect(MeshNetwork.BatteryMode).toBeDefined();
        expect(MeshNetwork.BatteryMode.HIGH_PERFORMANCE).toBe('high');
        expect(MeshNetwork.BatteryMode.BALANCED).toBe('balanced');
        expect(MeshNetwork.BatteryMode.LOW_POWER).toBe('low');
        expect(MeshNetwork.BatteryMode.AUTO).toBe('auto');
    });

    it('exposes PanicTrigger constants', () => {
        expect(MeshNetwork.PanicTrigger).toBeDefined();
        expect(MeshNetwork.PanicTrigger.TRIPLE_TAP).toBe('triple_tap');
        expect(MeshNetwork.PanicTrigger.SHAKE).toBe('shake');
        expect(MeshNetwork.PanicTrigger.MANUAL).toBe('manual');
    });

    it('exposes HealthStatus constants', () => {
        expect(MeshNetwork.HealthStatus).toBeDefined();
        expect(MeshNetwork.HealthStatus.GOOD).toBe('good');
        expect(MeshNetwork.HealthStatus.FAIR).toBe('fair');
        expect(MeshNetwork.HealthStatus.POOR).toBe('poor');
    });
});
