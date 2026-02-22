'use strict';

const BLETransport = require('../../src/transport/BLETransport');
const Transport = require('../../src/transport/Transport');
const { BLUETOOTH_STATE } = require('../../src/constants');

// Mock BLE adapter
function createMockAdapter(overrides = {}) {
  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    getState: jest.fn().mockResolvedValue(BLUETOOTH_STATE.POWERED_ON),
    onStateChange: jest.fn(),
    startScan: jest.fn().mockResolvedValue(undefined),
    stopScan: jest.fn(),
    connect: jest.fn().mockResolvedValue({ id: 'device-1', name: 'Test', rssi: -50 }),
    disconnect: jest.fn().mockResolvedValue(undefined),
    write: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('BLETransport', () => {
  let adapter;
  let transport;

  beforeEach(() => {
    adapter = createMockAdapter();
    transport = new BLETransport(adapter);
  });

  afterEach(async () => {
    try { await transport.stop(); } catch (e) { /* ignore */ }
  });

  describe('constructor', () => {
    it('requires an adapter', () => {
      expect(() => new BLETransport()).toThrow('BLE adapter is required');
    });

    it('accepts options', () => {
      const t = new BLETransport(adapter, { maxPeers: 4, connectTimeoutMs: 5000 });
      expect(t).toBeDefined();
    });
  });

  describe('start()', () => {
    it('initializes adapter and checks state', async () => {
      await transport.start();
      expect(adapter.initialize).toHaveBeenCalled();
      expect(adapter.getState).toHaveBeenCalled();
      expect(transport.isRunning).toBe(true);
    });

    it('throws if bluetooth is not powered on', async () => {
      adapter.getState.mockResolvedValue(BLUETOOTH_STATE.POWERED_OFF);
      await expect(transport.start()).rejects.toThrow();
    });

    it('is idempotent when already running', async () => {
      await transport.start();
      await transport.start(); // should not throw
      expect(adapter.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop()', () => {
    it('stops scanning and disconnects all peers', async () => {
      await transport.start();
      await transport.startScanning();
      await transport.connectToPeer('peer-1');
      await transport.stop();
      expect(adapter.stopScan).toHaveBeenCalled();
      expect(adapter.disconnect).toHaveBeenCalledWith('peer-1');
    });

    it('is idempotent when already stopped', async () => {
      await transport.stop();
      await transport.stop(); // should not throw
    });
  });

  describe('scanning', () => {
    it('starts and stops scanning', async () => {
      await transport.start();
      await transport.startScanning();
      expect(transport.isScanning).toBe(true);
      transport.stopScanning();
      expect(transport.isScanning).toBe(false);
    });

    it('does not scan when not running', async () => {
      await transport.startScanning();
      expect(transport.isScanning).toBe(false);
    });

    it('emits scanStarted and scanStopped', async () => {
      await transport.start();
      const started = jest.fn();
      const stopped = jest.fn();
      transport.on('scanStarted', started);
      transport.on('scanStopped', stopped);

      await transport.startScanning();
      expect(started).toHaveBeenCalled();

      transport.stopScanning();
      expect(stopped).toHaveBeenCalled();
    });
  });

  describe('connectToPeer()', () => {
    it('connects and subscribes to notifications', async () => {
      await transport.start();
      await transport.connectToPeer('peer-1');
      expect(adapter.connect).toHaveBeenCalledWith('peer-1');
      expect(adapter.subscribe).toHaveBeenCalled();
    });

    it('throws when not running', async () => {
      await expect(transport.connectToPeer('peer-1')).rejects.toThrow('not running');
    });

    it('throws on duplicate connection', async () => {
      await transport.start();
      await transport.connectToPeer('peer-1');
      await expect(transport.connectToPeer('peer-1')).rejects.toThrow();
    });

    it('emits peerConnected event', async () => {
      await transport.start();
      const handler = jest.fn();
      transport.on('peerConnected', handler);
      await transport.connectToPeer('peer-1');
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ peerId: 'peer-1' }));
    });

    it('handles connection timeout', async () => {
      const slowAdapter = createMockAdapter({
        connect: jest.fn(() => new Promise(() => {})), // never resolves
      });
      const t = new BLETransport(slowAdapter, { connectTimeoutMs: 50 });
      await t.start();
      await expect(t.connectToPeer('peer-1')).rejects.toThrow('timed out');
      await t.stop();
    });
  });

  describe('disconnectFromPeer()', () => {
    it('disconnects a connected peer', async () => {
      await transport.start();
      await transport.connectToPeer('peer-1');
      await transport.disconnectFromPeer('peer-1');
      expect(adapter.disconnect).toHaveBeenCalledWith('peer-1');
    });

    it('is safe for unknown peer', async () => {
      await transport.start();
      await transport.disconnectFromPeer('unknown'); // should not throw
    });
  });

  describe('send()', () => {
    it('sends data to a connected peer', async () => {
      await transport.start();
      await transport.connectToPeer('peer-1');
      const data = new Uint8Array([1, 2, 3]);
      await transport.send('peer-1', data);
      expect(adapter.write).toHaveBeenCalled();
    });

    it('throws for unconnected peer', async () => {
      await transport.start();
      await expect(transport.send('unknown', new Uint8Array([1]))).rejects.toThrow();
    });

    it('throws when not running', async () => {
      await expect(transport.send('peer-1', new Uint8Array([1]))).rejects.toThrow('not running');
    });
  });

  describe('broadcast()', () => {
    it('sends to all connected peers', async () => {
      await transport.start();
      await transport.connectToPeer('peer-1');
      adapter.connect.mockResolvedValue({ id: 'peer-2', name: 'Test2', rssi: -60 });
      await transport.connectToPeer('peer-2');
      const data = new Uint8Array([1, 2, 3]);
      const results = await transport.broadcast(data);
      expect(results).toHaveLength(2);
    });

    it('throws when not running', async () => {
      await expect(transport.broadcast(new Uint8Array([1]))).rejects.toThrow('not running');
    });
  });

  describe('power mode', () => {
    it('sets power mode', async () => {
      transport.setPowerMode('PERFORMANCE');
      // No assertion needed — just no throw
      transport.setPowerMode('POWER_SAVER');
    });
  });
});
