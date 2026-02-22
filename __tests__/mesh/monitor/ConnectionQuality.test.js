'use strict';

const { ConnectionQuality, PeerQualityTracker, QUALITY_LEVEL } = require('../../../src/mesh/monitor/ConnectionQuality');

describe('ConnectionQuality', () => {
  let cq;

  beforeEach(() => {
    cq = new ConnectionQuality({ updateIntervalMs: 100, peerTimeoutMs: 500 });
  });

  afterEach(() => {
    cq.destroy();
  });

  describe('QUALITY_LEVEL', () => {
    it('has all levels', () => {
      expect(QUALITY_LEVEL.EXCELLENT).toBe('excellent');
      expect(QUALITY_LEVEL.GOOD).toBe('good');
      expect(QUALITY_LEVEL.FAIR).toBe('fair');
      expect(QUALITY_LEVEL.POOR).toBe('poor');
      expect(QUALITY_LEVEL.DISCONNECTED).toBe('disconnected');
    });
  });

  describe('recording metrics', () => {
    it('records RSSI', () => {
      cq.recordRssi('peer-1', -55);
      cq.recordRssi('peer-1', -60);
      const q = cq.getQuality('peer-1');
      expect(q).not.toBeNull();
      expect(q.rssi).toBe(Math.round((-55 + -60) / 2)); // avg rounded
    });

    it('records latency', () => {
      cq.recordLatency('peer-1', 50);
      cq.recordLatency('peer-1', 100);
      const q = cq.getQuality('peer-1');
      expect(q.latencyMs).toBe(75);
    });

    it('calculates packet loss', () => {
      cq.recordPacketSent('peer-1');
      cq.recordPacketSent('peer-1');
      cq.recordPacketSent('peer-1');
      cq.recordPacketSent('peer-1');
      cq.recordPacketAcked('peer-1');
      cq.recordPacketAcked('peer-1');
      cq.recordPacketAcked('peer-1');
      // 3/4 acked = 25% loss
      const q = cq.getQuality('peer-1');
      expect(q.packetLoss).toBe(0.25);
    });

    it('records bytes for throughput', () => {
      cq.recordBytesTransferred('peer-1', 1000);
      const q = cq.getQuality('peer-1');
      expect(q.throughputKbps).toBeGreaterThanOrEqual(0);
    });

    it('sets transport type', () => {
      cq.recordRssi('peer-1', -50);
      cq.setTransport('peer-1', 'wifi-direct');
      const q = cq.getQuality('peer-1');
      expect(q.transport).toBe('wifi-direct');
    });
  });

  describe('quality calculation', () => {
    it('returns excellent for strong connection', () => {
      cq.recordRssi('peer-1', -40);
      cq.recordLatency('peer-1', 30);
      // No packet loss, some throughput
      cq.recordBytesTransferred('peer-1', 50000);
      const q = cq.getQuality('peer-1');
      expect(q.level).toBe(QUALITY_LEVEL.EXCELLENT);
      expect(q.score).toBeGreaterThanOrEqual(0.8);
    });

    it('returns poor for weak connection', () => {
      cq.recordRssi('peer-1', -90);
      cq.recordLatency('peer-1', 2000);
      for (let i = 0; i < 10; i++) cq.recordPacketSent('peer-1');
      cq.recordPacketAcked('peer-1'); // 90% loss
      const q = cq.getQuality('peer-1');
      expect(q.level).toBe(QUALITY_LEVEL.POOR);
    });

    it('returns null for unknown peer', () => {
      expect(cq.getQuality('unknown')).toBeNull();
    });
  });

  describe('getAllQuality()', () => {
    it('returns all peers', () => {
      cq.recordRssi('peer-1', -50);
      cq.recordRssi('peer-2', -70);
      const all = cq.getAllQuality();
      expect(all).toHaveLength(2);
      expect(all.map(q => q.peerId).sort()).toEqual(['peer-1', 'peer-2']);
    });
  });

  describe('removePeer()', () => {
    it('removes a peer tracker', () => {
      cq.recordRssi('peer-1', -50);
      cq.removePeer('peer-1');
      expect(cq.getQuality('peer-1')).toBeNull();
    });
  });

  describe('disconnected detection', () => {
    it('marks peer as disconnected after timeout', async () => {
      const shortTimeout = new ConnectionQuality({ peerTimeoutMs: 50 });
      shortTimeout.recordRssi('peer-1', -50);
      
      await new Promise(r => setTimeout(r, 100));
      
      const q = shortTimeout.getQuality('peer-1');
      expect(q.level).toBe(QUALITY_LEVEL.DISCONNECTED);
      expect(q.score).toBe(0);
      shortTimeout.destroy();
    });
  });

  describe('events', () => {
    it('emits qualityChanged when level changes', async () => {
      cq.start();
      const handler = jest.fn();
      cq.on('qualityChanged', handler);

      // Start with excellent
      cq.recordRssi('peer-1', -40);
      cq.recordLatency('peer-1', 30);
      
      // Force an update cycle
      cq._update();
      
      // Degrade to poor
      for (let i = 0; i < 25; i++) {
        cq.recordRssi('peer-1', -95);
        cq.recordLatency('peer-1', 3000);
      }
      
      cq._update();

      // Should have emitted at least once for the quality change
      expect(handler).toHaveBeenCalled();
      cq.stop();
    });
  });

  describe('lifecycle', () => {
    it('start/stop is safe', () => {
      cq.start();
      cq.start(); // idempotent
      cq.stop();
      cq.stop(); // idempotent
    });

    it('destroy cleans up', () => {
      cq.recordRssi('peer-1', -50);
      cq.destroy();
      expect(cq.getAllQuality()).toEqual([]);
    });
  });
});

describe('PeerQualityTracker', () => {
  it('calculates with no data', () => {
    const tracker = new PeerQualityTracker('peer-1', {
      sampleSize: 20,
      peerTimeoutMs: 30000,
      weights: { rssi: 0.3, latency: 0.3, packetLoss: 0.25, throughput: 0.15 },
      rssiThresholds: { excellent: -50, good: -70, fair: -85 },
      latencyThresholds: { excellent: 100, good: 300, fair: 1000 },
      packetLossThresholds: { excellent: 0.01, good: 0.05, fair: 0.15 },
      throughputThresholds: { excellent: 200, good: 100, fair: 50 },
    });
    const q = tracker.calculate();
    expect(q.level).toBeDefined();
    expect(q.peerId).toBe('peer-1');
  });

  it('caps sample size', () => {
    const tracker = new PeerQualityTracker('peer-1', {
      sampleSize: 3,
      peerTimeoutMs: 30000,
      weights: { rssi: 0.3, latency: 0.3, packetLoss: 0.25, throughput: 0.15 },
      rssiThresholds: { excellent: -50, good: -70, fair: -85 },
      latencyThresholds: { excellent: 100, good: 300, fair: 1000 },
      packetLossThresholds: { excellent: 0.01, good: 0.05, fair: 0.15 },
      throughputThresholds: { excellent: 200, good: 100, fair: 50 },
    });
    tracker.recordRssi(-50);
    tracker.recordRssi(-60);
    tracker.recordRssi(-70);
    tracker.recordRssi(-80); // should evict -50
    expect(tracker.getAvgRssi()).toBe(-70); // avg of -60, -70, -80
  });
});
