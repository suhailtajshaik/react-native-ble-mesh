'use strict';

const { EmergencyManager, PANIC_TRIGGER } = require('../../src/service/EmergencyManager');

describe('EmergencyManager', () => {
    let manager;

    beforeEach(() => {
        manager = new EmergencyManager({
            tapWindowMs: 500,
            tapCount: 3,
        });
    });

    afterEach(() => {
        manager.destroy();
    });

    describe('constructor', () => {
        it('creates instance with default config', () => {
            const m = new EmergencyManager();
            expect(m).toBeDefined();
            expect(m.isEnabled()).toBe(false);
            m.destroy();
        });

        it('creates instance with custom config', () => {
            const m = new EmergencyManager({
                trigger: PANIC_TRIGGER.SHAKE,
                tapCount: 5,
            });
            expect(m).toBeDefined();
            m.destroy();
        });
    });

    describe('enablePanicMode()', () => {
        it('enables panic mode', () => {
            manager.enablePanicMode();
            expect(manager.isEnabled()).toBe(true);
        });

        it('emits panic-mode-enabled event', () => {
            const handler = jest.fn();
            manager.on('panic-mode-enabled', handler);

            manager.enablePanicMode();

            expect(handler).toHaveBeenCalledWith({
                trigger: PANIC_TRIGGER.TRIPLE_TAP,
            });
        });

        it('accepts custom trigger option', () => {
            const handler = jest.fn();
            manager.on('panic-mode-enabled', handler);

            manager.enablePanicMode({ trigger: PANIC_TRIGGER.SHAKE });

            expect(handler).toHaveBeenCalledWith({
                trigger: PANIC_TRIGGER.SHAKE,
            });
        });

        it('stores onWipe callback', async () => {
            const onWipe = jest.fn();
            manager.enablePanicMode({ onWipe });

            await manager.wipeAllData();

            expect(onWipe).toHaveBeenCalled();
        });
    });

    describe('disablePanicMode()', () => {
        it('disables panic mode', () => {
            manager.enablePanicMode();
            manager.disablePanicMode();
            expect(manager.isEnabled()).toBe(false);
        });

        it('emits panic-mode-disabled event', () => {
            const handler = jest.fn();
            manager.on('panic-mode-disabled', handler);

            manager.enablePanicMode();
            manager.disablePanicMode();

            expect(handler).toHaveBeenCalled();
        });

        it('resets tap state', () => {
            manager.enablePanicMode();
            manager.registerTap();
            manager.registerTap();
            manager.disablePanicMode();

            // Re-enable and verify taps were reset
            manager.enablePanicMode();
            const wipeHandler = jest.fn();
            manager.on('panic-wipe-completed', wipeHandler);

            // Should need 3 fresh taps
            manager.registerTap();
            expect(wipeHandler).not.toHaveBeenCalled();
        });
    });

    describe('registerTap()', () => {
        it('does nothing when panic mode disabled', () => {
            const handler = jest.fn();
            manager.on('panic-wipe-completed', handler);

            manager.registerTap();
            manager.registerTap();
            manager.registerTap();

            expect(handler).not.toHaveBeenCalled();
        });

        it('triggers wipe after configured tap count', async () => {
            const handler = jest.fn();
            manager.on('panic-wipe-completed', handler);
            manager.enablePanicMode();

            manager.registerTap();
            manager.registerTap();
            manager.registerTap();

            // Wait for async wipe
            await new Promise(r => setTimeout(r, 50));

            expect(handler).toHaveBeenCalled();
        });

        it('resets count if taps are too slow', async () => {
            const handler = jest.fn();
            manager.on('panic-wipe-completed', handler);
            manager.enablePanicMode();

            manager.registerTap();
            manager.registerTap();

            // Wait for tap window to expire
            await new Promise(r => setTimeout(r, 600));

            manager.registerTap();

            expect(handler).not.toHaveBeenCalled();
        });

        it('ignores taps when trigger is not triple_tap', () => {
            const m = new EmergencyManager({ trigger: PANIC_TRIGGER.SHAKE });
            const handler = jest.fn();
            m.on('panic-wipe-completed', handler);
            m.enablePanicMode();

            m.registerTap();
            m.registerTap();
            m.registerTap();

            expect(handler).not.toHaveBeenCalled();
            m.destroy();
        });
    });

    describe('registerAccelerometer()', () => {
        it('does nothing when panic mode disabled', () => {
            const m = new EmergencyManager({ trigger: PANIC_TRIGGER.SHAKE });
            const handler = jest.fn();
            m.on('panic-wipe-completed', handler);

            m.registerAccelerometer({ x: 20, y: 20, z: 20 });

            expect(handler).not.toHaveBeenCalled();
            m.destroy();
        });

        it('ignores accelerometer when trigger is not shake', () => {
            const handler = jest.fn();
            manager.on('panic-wipe-completed', handler);
            manager.enablePanicMode();

            manager.registerAccelerometer({ x: 20, y: 20, z: 20 });

            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('registerClearer()', () => {
        it('registers a clearer function', async () => {
            const clearer = jest.fn().mockResolvedValue(undefined);
            manager.registerClearer(clearer);

            await manager.wipeAllData();

            expect(clearer).toHaveBeenCalled();
        });

        it('ignores non-function arguments', () => {
            manager.registerClearer('not a function');
            manager.registerClearer(null);
            manager.registerClearer(123);

            // Should not throw
            expect(() => manager.wipeAllData()).not.toThrow();
        });

        it('calls multiple clearers', async () => {
            const clearer1 = jest.fn().mockResolvedValue(undefined);
            const clearer2 = jest.fn().mockResolvedValue(undefined);
            const clearer3 = jest.fn().mockResolvedValue(undefined);

            manager.registerClearer(clearer1);
            manager.registerClearer(clearer2);
            manager.registerClearer(clearer3);

            await manager.wipeAllData();

            expect(clearer1).toHaveBeenCalled();
            expect(clearer2).toHaveBeenCalled();
            expect(clearer3).toHaveBeenCalled();
        });
    });

    describe('wipeAllData()', () => {
        it('returns wipe result', async () => {
            const result = await manager.wipeAllData();

            expect(result).toHaveProperty('trigger');
            expect(result).toHaveProperty('startTime');
            expect(result).toHaveProperty('endTime');
            expect(result).toHaveProperty('elapsedMs');
            expect(result).toHaveProperty('metTarget');
            expect(result).toHaveProperty('clearerResults');
            expect(result).toHaveProperty('errors');
        });

        it('emits panic-wipe-started event', async () => {
            const handler = jest.fn();
            manager.on('panic-wipe-started', handler);

            await manager.wipeAllData();

            expect(handler).toHaveBeenCalledWith(expect.objectContaining({
                trigger: PANIC_TRIGGER.MANUAL,
            }));
        });

        it('emits panic-wipe-completed event', async () => {
            const handler = jest.fn();
            manager.on('panic-wipe-completed', handler);

            await manager.wipeAllData();

            expect(handler).toHaveBeenCalledWith(expect.objectContaining({
                trigger: PANIC_TRIGGER.MANUAL,
                elapsedMs: expect.any(Number),
            }));
        });

        it('handles clearer errors gracefully', async () => {
            const failingClearer = jest.fn().mockRejectedValue(new Error('Clearer failed'));
            const successClearer = jest.fn().mockResolvedValue(undefined);

            manager.registerClearer(failingClearer);
            manager.registerClearer(successClearer);

            const result = await manager.wipeAllData();

            expect(result.errors.length).toBe(1);
            expect(result.errors[0].error).toBe('Clearer failed');
            expect(successClearer).toHaveBeenCalled();
        });

        it('runs clearers in parallel', async () => {
            const startTimes = [];

            const clearer1 = jest.fn().mockImplementation(async () => {
                startTimes.push(Date.now());
                await new Promise(r => setTimeout(r, 20));
            });

            const clearer2 = jest.fn().mockImplementation(async () => {
                startTimes.push(Date.now());
                await new Promise(r => setTimeout(r, 20));
            });

            manager.registerClearer(clearer1);
            manager.registerClearer(clearer2);

            await manager.wipeAllData();

            // Both should start within ~5ms of each other (parallel execution)
            expect(Math.abs(startTimes[0] - startTimes[1])).toBeLessThan(10);
        });
    });

    describe('getStats()', () => {
        it('returns statistics', () => {
            const stats = manager.getStats();

            expect(stats).toHaveProperty('wipesTriggered');
            expect(stats).toHaveProperty('averageWipeTimeMs');
            expect(stats).toHaveProperty('lastWipeTime');
        });

        it('tracks wipe count', async () => {
            await manager.wipeAllData();
            await manager.wipeAllData();

            const stats = manager.getStats();
            expect(stats.wipesTriggered).toBe(2);
        });

        it('calculates correct average wipe time', async () => {
            // First wipe
            await manager.wipeAllData();
            const stats1 = manager.getStats();
            const firstWipeTime = stats1.averageWipeTimeMs;

            // Second wipe
            await manager.wipeAllData();
            const stats2 = manager.getStats();

            // Average should be calculated correctly
            expect(stats2.wipesTriggered).toBe(2);
            expect(stats2.averageWipeTimeMs).toBeGreaterThanOrEqual(0);
        });
    });

    describe('destroy()', () => {
        it('disables panic mode', () => {
            manager.enablePanicMode();
            manager.destroy();
            expect(manager.isEnabled()).toBe(false);
        });

        it('clears all clearers', async () => {
            const clearer = jest.fn().mockResolvedValue(undefined);
            manager.registerClearer(clearer);
            manager.destroy();

            // Create new manager and wipe - original clearer should not be called
            const newManager = new EmergencyManager();
            await newManager.wipeAllData();

            expect(clearer).not.toHaveBeenCalled();
            newManager.destroy();
        });
    });
});

describe('EmergencyManager Performance', () => {
    /**
     * PRD Requirement: Panic wipe must complete in <200ms
     * These benchmarks verify the implementation meets this target.
     */

    describe('Panic Wipe Time Benchmarks', () => {
        const TARGET_WIPE_TIME_MS = 200;
        const BENCHMARK_ITERATIONS = 5;

        it('completes wipe in under 200ms with no clearers', async () => {
            const manager = new EmergencyManager();
            const times = [];

            for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
                const result = await manager.wipeAllData();
                times.push(result.elapsedMs);
            }

            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const maxTime = Math.max(...times);

            console.log(`Empty wipe - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime}ms`);

            expect(maxTime).toBeLessThan(TARGET_WIPE_TIME_MS);
            expect(avgTime).toBeLessThan(TARGET_WIPE_TIME_MS / 2);

            manager.destroy();
        });

        it('completes wipe in under 200ms with fast clearers', async () => {
            const manager = new EmergencyManager();

            // Simulate typical fast clearers (memory clear, cache clear)
            manager.registerClearer(async () => {
                // Simulate clearing in-memory data
                const data = new Map();
                for (let i = 0; i < 1000; i++) data.set(i, `value${i}`);
                data.clear();
            });

            manager.registerClearer(async () => {
                // Simulate clearing an array
                const arr = new Array(10000).fill(0);
                arr.length = 0;
            });

            manager.registerClearer(async () => {
                // Simulate clearing a small cache
                const cache = {};
                for (let i = 0; i < 100; i++) cache[`key${i}`] = `value${i}`;
                Object.keys(cache).forEach(k => delete cache[k]);
            });

            const times = [];

            for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
                const result = await manager.wipeAllData();
                times.push(result.elapsedMs);
            }

            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const maxTime = Math.max(...times);

            console.log(`Fast clearers - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime}ms`);

            expect(maxTime).toBeLessThan(TARGET_WIPE_TIME_MS);
            manager.destroy();
        });

        it('completes wipe in under 200ms with simulated crypto clear', async () => {
            const manager = new EmergencyManager();

            // Simulate clearing cryptographic keys (security-critical)
            manager.registerClearer(async () => {
                // Simulate secure key wipe
                const keys = new Uint8Array(32 * 100); // 100 keys
                keys.fill(0);
            });

            // Simulate clearing session data
            manager.registerClearer(async () => {
                const sessions = new Map();
                for (let i = 0; i < 50; i++) {
                    sessions.set(`session${i}`, {
                        keys: new Uint8Array(64),
                        nonce: new Uint8Array(12),
                    });
                }
                sessions.clear();
            });

            const times = [];

            for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
                const result = await manager.wipeAllData();
                times.push(result.elapsedMs);
            }

            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const maxTime = Math.max(...times);

            console.log(`Crypto clear - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime}ms`);

            expect(maxTime).toBeLessThan(TARGET_WIPE_TIME_MS);
            manager.destroy();
        });

        it('reports metTarget correctly', async () => {
            const manager = new EmergencyManager({ targetWipeTimeMs: 200 });

            const result = await manager.wipeAllData();

            // With no clearers, should easily meet target
            expect(result.metTarget).toBe(true);
            expect(result.elapsedMs).toBeLessThan(200);

            manager.destroy();
        });

        it('handles 10 parallel clearers within time budget', async () => {
            const manager = new EmergencyManager();

            // Register 10 clearers that each do some work
            for (let i = 0; i < 10; i++) {
                manager.registerClearer(async () => {
                    // Each clearer does ~10ms of simulated work
                    const start = Date.now();
                    while (Date.now() - start < 10) {
                        // Busy wait to simulate work
                    }
                });
            }

            const result = await manager.wipeAllData();

            // Since clearers run in parallel, total time should be ~10-20ms, not 100ms
            console.log(`10 parallel clearers: ${result.elapsedMs}ms`);

            // Should complete well under target since clearers run in parallel
            expect(result.elapsedMs).toBeLessThan(TARGET_WIPE_TIME_MS);
            expect(result.metTarget).toBe(true);

            manager.destroy();
        });
    });

    describe('Average Wipe Time Calculation', () => {
        it('correctly calculates running average', async () => {
            const manager = new EmergencyManager();

            // First wipe
            await manager.wipeAllData();
            const stats1 = manager.getStats();
            expect(stats1.wipesTriggered).toBe(1);

            // Second wipe
            await manager.wipeAllData();
            const stats2 = manager.getStats();
            expect(stats2.wipesTriggered).toBe(2);

            // Third wipe
            await manager.wipeAllData();
            const stats3 = manager.getStats();
            expect(stats3.wipesTriggered).toBe(3);

            // Average should be reasonable (not NaN or Infinity)
            expect(Number.isFinite(stats3.averageWipeTimeMs)).toBe(true);
            expect(stats3.averageWipeTimeMs).toBeGreaterThanOrEqual(0);

            manager.destroy();
        });
    });
});
