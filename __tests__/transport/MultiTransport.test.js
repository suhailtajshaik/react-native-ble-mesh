'use strict';

const { MultiTransport, STRATEGY } = require('../../src/transport/MultiTransport');
const MockTransport = require('../../src/transport/MockTransport');

describe('MultiTransport', () => {
  let ble, wifi, multi;

  beforeEach(() => {
    ble = new MockTransport({ localPeerId: 'ble-node' });
    wifi = new MockTransport({ localPeerId: 'wifi-node' });
    multi = new MultiTransport({
      bleTransport: ble,
      wifiTransport: wifi,
      strategy: STRATEGY.AUTO,
      wifiThresholdBytes: 100,
    });
  });

  afterEach(async () => {
    try { await multi.stop(); } catch (e) {}
  });

  describe('start()', () => {
    it('starts both transports', async () => {
      await multi.start();
      expect(multi.isRunning).toBe(true);
      expect(ble.isRunning).toBe(true);
      expect(wifi.isRunning).toBe(true);
    });

    it('succeeds if only BLE starts', async () => {
      const badWifi = new MockTransport({ localPeerId: 'bad' });
      badWifi.start = jest.fn().mockRejectedValue(new Error('fail'));
      const m = new MultiTransport({ bleTransport: ble, wifiTransport: badWifi });
      await m.start();
      expect(m.isRunning).toBe(true);
      await m.stop();
    });

    it('fails if no transports start', async () => {
      const badBle = new MockTransport({ localPeerId: 'bad1' });
      const badWifi = new MockTransport({ localPeerId: 'bad2' });
      badBle.start = jest.fn().mockRejectedValue(new Error('fail'));
      badWifi.start = jest.fn().mockRejectedValue(new Error('fail'));
      const m = new MultiTransport({ bleTransport: badBle, wifiTransport: badWifi });
      await expect(m.start()).rejects.toThrow('No transports');
    });
  });

  describe('stop()', () => {
    it('stops all transports', async () => {
      await multi.start();
      await multi.stop();
      expect(multi.isRunning).toBe(false);
    });
  });

  describe('getAvailableTransports()', () => {
    it('returns configured transports', () => {
      expect(multi.getAvailableTransports()).toEqual(['ble', 'wifi-direct']);
    });

    it('handles missing transports', () => {
      const m = new MultiTransport({ bleTransport: ble });
      expect(m.getAvailableTransports()).toEqual(['ble']);
    });
  });

  describe('send() with AUTO strategy', () => {
    it('uses BLE for small messages', async () => {
      await multi.start();
      ble.simulatePeerConnect('peer-1');

      const bleSend = jest.spyOn(ble, 'send');
      await multi.send('peer-1', new Uint8Array(50)); // < 100 threshold
      expect(bleSend).toHaveBeenCalled();
    });

    it('uses Wi-Fi for large messages when available', async () => {
      await multi.start();
      ble.simulatePeerConnect('peer-1');
      wifi.simulatePeerConnect('peer-1');

      const wifiSend = jest.spyOn(wifi, 'send');
      await multi.send('peer-1', new Uint8Array(200)); // > 100 threshold
      expect(wifiSend).toHaveBeenCalled();
    });

    it('falls back to BLE for large messages if Wi-Fi not connected', async () => {
      await multi.start();
      ble.simulatePeerConnect('peer-1');
      // wifi NOT connected to peer-1

      const bleSend = jest.spyOn(ble, 'send');
      await multi.send('peer-1', new Uint8Array(200));
      expect(bleSend).toHaveBeenCalled();
    });
  });

  describe('getConnectedPeers()', () => {
    it('merges peers from all transports', async () => {
      await multi.start();
      ble.simulatePeerConnect('peer-1');
      wifi.simulatePeerConnect('peer-2');

      const peers = multi.getConnectedPeers();
      expect(peers).toContain('peer-1');
      expect(peers).toContain('peer-2');
    });

    it('deduplicates peers on both transports', async () => {
      await multi.start();
      ble.simulatePeerConnect('peer-1');
      wifi.simulatePeerConnect('peer-1');

      const peers = multi.getConnectedPeers();
      expect(peers.filter(p => p === 'peer-1')).toHaveLength(1);
    });
  });

  describe('getTransportForPeer()', () => {
    it('returns null for unknown peer', () => {
      expect(multi.getTransportForPeer('unknown')).toBeNull();
    });
  });

  describe('broadcast()', () => {
    it('sends to all peers across transports', async () => {
      await multi.start();
      ble.simulatePeerConnect('peer-1');
      wifi.simulatePeerConnect('peer-2');

      const result = await multi.broadcast(new Uint8Array([1, 2]));
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('STRATEGY constants', () => {
    it('has expected values', () => {
      expect(STRATEGY.AUTO).toBe('auto');
      expect(STRATEGY.BLE_ONLY).toBe('ble-only');
      expect(STRATEGY.WIFI_ONLY).toBe('wifi-only');
      expect(STRATEGY.REDUNDANT).toBe('redundant');
    });
  });
});
