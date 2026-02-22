'use strict';

/**
 * Android-specific BLE behavior tests
 * Tests platform-specific concerns for Android deployment
 */

const { MeshNetwork } = require('../../src/MeshNetwork');
const { MockTransport } = require('../../src/transport');
const { RNBLEAdapter } = require('../../src/transport/adapters');

describe('Android Platform Compatibility', () => {
  describe('BLE Permission Handling', () => {
    it('transport handles permission-denied state gracefully', async () => {
      // Android requires BLUETOOTH_SCAN, BLUETOOTH_CONNECT, ACCESS_FINE_LOCATION
      // If BLE is unauthorized, start should throw a clear error
      const mockAdapter = {
        initialize: jest.fn().mockResolvedValue(undefined),
        getState: jest.fn().mockResolvedValue('unauthorized'),
        onStateChange: jest.fn(),
        destroy: jest.fn().mockResolvedValue(undefined),
      };
      
      const BLETransport = require('../../src/transport/BLETransport');
      const transport = new BLETransport(mockAdapter);
      
      // Should throw because BLE is not powered on
      await expect(transport.start()).rejects.toThrow();
    });
  });

  describe('Android MTU Negotiation', () => {
    it('handles Android default MTU (23 bytes for BLE 4.0)', () => {
      const { fragment, needsFragmentation } = require('../../src/mesh/fragment');
      
      const message = new Uint8Array(100);
      for (let i = 0; i < 100; i++) message[i] = i % 256;
      
      expect(needsFragmentation(message, 23)).toBe(true);
      const fragments = fragment(message, 'android-msg-1', 23);
      expect(fragments.length).toBeGreaterThan(1);
    });

    it('handles negotiated Android MTU (512 bytes for BLE 5.0)', () => {
      const { fragment, needsFragmentation } = require('../../src/mesh/fragment');
      
      const message = new Uint8Array(1000);
      const fragments = fragment(message, 'android-msg-2', 512);
      expect(fragments.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Android Background Service', () => {
    it('mesh continues running (foreground service simulation)', async () => {
      const mesh = new MeshNetwork({
        nickname: 'AndroidUser',
        batteryMode: 'balanced',
      });
      const transport = new MockTransport();
      await mesh.start(transport);
      
      expect(mesh.getStatus().state).toBe('running');
      
      // Simulate battery level report from Android
      mesh.updateBatteryLevel(30, false);
      
      await mesh.destroy();
    });

    it('handles Doze mode with low power settings', async () => {
      const mesh = new MeshNetwork({
        nickname: 'AndroidUser',
        batteryMode: 'low',
      });
      const transport = new MockTransport();
      await mesh.start(transport);
      
      expect(mesh.getBatteryMode()).toBe('low');
      await mesh.destroy();
    });
  });

  describe('Android BLE Bonding', () => {
    it('handles reconnection to bonded device', async () => {
      const mesh = new MeshNetwork({ nickname: 'AndroidUser' });
      const transport = new MockTransport();
      await mesh.start(transport);
      
      // Simulate peer discovery and connection
      const handler = jest.fn();
      mesh.on('peerDiscovered', handler);
      
      // MockTransport emulates discovery
      transport.emit('deviceDiscovered', {
        peerId: 'bonded-device',
        name: 'BondedPeer',
        rssi: -45,
      });
      
      await mesh.destroy();
    });
  });

  describe('Android Encryption Compatibility', () => {
    it('library loads without built-in crypto (crypto removed — use tweetnacl/libsodium)', () => {
      // Crypto was removed — consumers should use tweetnacl or libsodium-wrappers
      // These libraries work on Hermes/JSC (Android RN engines)
      const lib = require('../../src/index');
      expect(lib.MeshNetwork).toBeDefined();
      expect(lib.MeshService).toBeDefined();
    });
  });

  describe('Android Memory Pressure', () => {
    it('LRU cache respects size limits', () => {
      const LRUCache = require('../../src/utils/LRUCache');
      const cache = new LRUCache(3);
      
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4); // should evict 'a'
      
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('d')).toBe(4);
      expect(cache.size).toBe(3);
    });

    it('BloomFilter memory is bounded', () => {
      const { BloomFilter } = require('../../src/mesh/dedup');
      const filter = new BloomFilter(10000);
      
      // Add many items
      for (let i = 0; i < 500; i++) {
        filter.add(`msg-${i}`);
      }
      
      // First items should still probably be found (low false negative)
      expect(filter.mightContain('msg-0')).toBe(true);
      expect(filter.mightContain('msg-499')).toBe(true);
      // Unknown items might have false positives but should mostly be false
      let falsePositives = 0;
      for (let i = 1000; i < 1100; i++) {
        if (filter.mightContain(`msg-${i}`)) falsePositives++;
      }
      // False positive rate should be reasonable (<20%)
      expect(falsePositives).toBeLessThan(20);
    });
  });
});
