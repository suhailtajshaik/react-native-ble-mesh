'use strict';

const { StoreAndForwardManager } = require('../../src/mesh/store');

describe('StoreAndForwardManager', () => {
    let manager;

    beforeEach(() => {
        manager = new StoreAndForwardManager({
            retentionMs: 60 * 60 * 1000, // 1 hour
            maxTotalMessages: 100,
            maxMessagesPerRecipient: 10,
            cleanupIntervalMs: 60 * 60 * 1000, // Disable auto-cleanup for tests
        });
    });

    afterEach(() => {
        manager.destroy();
    });

    describe('constructor', () => {
        it('creates instance with default config', () => {
            const m = new StoreAndForwardManager();
            expect(m).toBeDefined();
            m.destroy();
        });

        it('creates instance with custom config', () => {
            expect(manager).toBeDefined();
        });
    });

    describe('cacheForOfflinePeer()', () => {
        it('caches a message for offline peer', async () => {
            const peerId = 'peer-123';
            const payload = new Uint8Array([1, 2, 3, 4, 5]);

            const messageId = await manager.cacheForOfflinePeer(peerId, payload);

            expect(messageId).toBeDefined();
            expect(typeof messageId).toBe('string');
            expect(manager.hasCachedMessages(peerId)).toBe(true);
            expect(manager.getCachedCount(peerId)).toBe(1);
        });

        it('caches multiple messages for same peer', async () => {
            const peerId = 'peer-123';

            await manager.cacheForOfflinePeer(peerId, new Uint8Array([1, 2, 3]));
            await manager.cacheForOfflinePeer(peerId, new Uint8Array([4, 5, 6]));
            await manager.cacheForOfflinePeer(peerId, new Uint8Array([7, 8, 9]));

            expect(manager.getCachedCount(peerId)).toBe(3);
        });

        it('caches messages for different peers', async () => {
            await manager.cacheForOfflinePeer('peer-1', new Uint8Array([1]));
            await manager.cacheForOfflinePeer('peer-2', new Uint8Array([2]));
            await manager.cacheForOfflinePeer('peer-3', new Uint8Array([3]));

            expect(manager.getCachedCount('peer-1')).toBe(1);
            expect(manager.getCachedCount('peer-2')).toBe(1);
            expect(manager.getCachedCount('peer-3')).toBe(1);
            expect(manager.getRecipientsWithCache()).toHaveLength(3);
        });

        it('accepts custom message ID', async () => {
            const customId = 'custom-msg-id-123';
            const messageId = await manager.cacheForOfflinePeer(
                'peer-1',
                new Uint8Array([1]),
                { messageId: customId }
            );

            expect(messageId).toBe(customId);
        });

        it('throws ValidationError for invalid recipientId', async () => {
            await expect(manager.cacheForOfflinePeer('', new Uint8Array([1])))
                .rejects.toThrow('ValidationError');
            await expect(manager.cacheForOfflinePeer(null, new Uint8Array([1])))
                .rejects.toThrow('ValidationError');
        });

        it('throws ValidationError for invalid payload', async () => {
            await expect(manager.cacheForOfflinePeer('peer-1', 'not a Uint8Array'))
                .rejects.toThrow('ValidationError');
        });

        it('respects per-recipient limit', async () => {
            const peerId = 'peer-1';

            // Add 15 messages (limit is 10)
            for (let i = 0; i < 15; i++) {
                await manager.cacheForOfflinePeer(peerId, new Uint8Array([i]));
            }

            // Should only have 10 messages (oldest dropped)
            expect(manager.getCachedCount(peerId)).toBe(10);
        });
    });

    describe('deliverCachedMessages()', () => {
        it('delivers all cached messages', async () => {
            const peerId = 'peer-123';
            const deliveredPayloads = [];

            await manager.cacheForOfflinePeer(peerId, new Uint8Array([1, 2]));
            await manager.cacheForOfflinePeer(peerId, new Uint8Array([3, 4]));

            const result = await manager.deliverCachedMessages(peerId, async (payload) => {
                deliveredPayloads.push(Array.from(payload));
            });

            expect(result.delivered).toBe(2);
            expect(result.failed).toBe(0);
            expect(deliveredPayloads).toHaveLength(2);
            expect(deliveredPayloads[0]).toEqual([1, 2]);
            expect(deliveredPayloads[1]).toEqual([3, 4]);
            expect(manager.hasCachedMessages(peerId)).toBe(false);
        });

        it('handles delivery failures', async () => {
            const peerId = 'peer-123';
            let callCount = 0;

            await manager.cacheForOfflinePeer(peerId, new Uint8Array([1]));
            await manager.cacheForOfflinePeer(peerId, new Uint8Array([2]));

            const result = await manager.deliverCachedMessages(peerId, async () => {
                callCount++;
                if (callCount === 1) {
                    throw new Error('Delivery failed');
                }
            });

            expect(result.delivered).toBe(1);
            expect(result.failed).toBe(1);
            // Failed message should remain in cache
            expect(manager.getCachedCount(peerId)).toBe(1);
        });

        it('returns empty result for unknown peer', async () => {
            const result = await manager.deliverCachedMessages('unknown-peer', async () => { });

            expect(result.delivered).toBe(0);
            expect(result.failed).toBe(0);
        });
    });

    describe('hasCachedMessages()', () => {
        it('returns false for unknown peer', () => {
            expect(manager.hasCachedMessages('unknown')).toBe(false);
        });

        it('returns true after caching message', async () => {
            await manager.cacheForOfflinePeer('peer-1', new Uint8Array([1]));
            expect(manager.hasCachedMessages('peer-1')).toBe(true);
        });

        it('returns false after delivering all messages', async () => {
            await manager.cacheForOfflinePeer('peer-1', new Uint8Array([1]));
            await manager.deliverCachedMessages('peer-1', async () => { });
            expect(manager.hasCachedMessages('peer-1')).toBe(false);
        });
    });

    describe('clearRecipientCache()', () => {
        it('clears all messages for recipient', async () => {
            await manager.cacheForOfflinePeer('peer-1', new Uint8Array([1]));
            await manager.cacheForOfflinePeer('peer-1', new Uint8Array([2]));
            await manager.cacheForOfflinePeer('peer-2', new Uint8Array([3]));

            const removed = manager.clearRecipientCache('peer-1');

            expect(removed).toBe(2);
            expect(manager.hasCachedMessages('peer-1')).toBe(false);
            expect(manager.hasCachedMessages('peer-2')).toBe(true);
        });

        it('returns 0 for unknown peer', () => {
            expect(manager.clearRecipientCache('unknown')).toBe(0);
        });
    });

    describe('getStats()', () => {
        it('returns statistics', async () => {
            await manager.cacheForOfflinePeer('peer-1', new Uint8Array([1, 2, 3]));

            const stats = manager.getStats();

            expect(stats.messagesCached).toBe(1);
            expect(stats.totalCached).toBe(1);
            expect(stats.totalSizeBytes).toBe(3);
            expect(stats.recipientCount).toBe(1);
        });

        it('tracks delivery statistics', async () => {
            await manager.cacheForOfflinePeer('peer-1', new Uint8Array([1]));
            await manager.deliverCachedMessages('peer-1', async () => { });

            const stats = manager.getStats();

            expect(stats.messagesDelivered).toBe(1);
            expect(stats.deliveryAttempts).toBe(1);
        });
    });

    describe('clear()', () => {
        it('clears all cached messages', async () => {
            await manager.cacheForOfflinePeer('peer-1', new Uint8Array([1]));
            await manager.cacheForOfflinePeer('peer-2', new Uint8Array([2]));

            manager.clear();

            expect(manager.getRecipientsWithCache()).toHaveLength(0);
            const stats = manager.getStats();
            expect(stats.totalCached).toBe(0);
        });
    });

    describe('events', () => {
        it('emits message-cached event', async () => {
            const handler = jest.fn();
            manager.on('message-cached', handler);

            await manager.cacheForOfflinePeer('peer-1', new Uint8Array([1]));

            expect(handler).toHaveBeenCalledWith(expect.objectContaining({
                recipientId: 'peer-1',
            }));
        });

        it('emits message-delivered event', async () => {
            const handler = jest.fn();
            manager.on('message-delivered', handler);

            await manager.cacheForOfflinePeer('peer-1', new Uint8Array([1]));
            await manager.deliverCachedMessages('peer-1', async () => { });

            expect(handler).toHaveBeenCalledWith(expect.objectContaining({
                recipientId: 'peer-1',
            }));
        });
    });
});
