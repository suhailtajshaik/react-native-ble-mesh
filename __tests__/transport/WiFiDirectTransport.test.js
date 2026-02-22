'use strict';

const { WiFiDirectTransport } = require('../../src/transport/WiFiDirectTransport');

function createMockWifiP2p() {
  return {
    initialize: jest.fn().mockResolvedValue(true),
    isSuccessfulInitialize: jest.fn().mockResolvedValue(true),
    discoverPeers: jest.fn().mockResolvedValue(undefined),
    stopDiscoveringPeers: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn().mockResolvedValue(undefined),
    getConnectionInfo: jest.fn().mockResolvedValue({
      isGroupOwner: false,
      groupOwnerAddress: '192.168.49.1',
    }),
    removeGroup: jest.fn().mockResolvedValue(undefined),
    sendMessage: jest.fn().mockResolvedValue(undefined),
    sendMessageTo: jest.fn().mockResolvedValue(undefined),
    getAvailablePeers: jest.fn().mockResolvedValue([]),
  };
}

describe('WiFiDirectTransport', () => {
  let mockP2p;
  let transport;

  beforeEach(() => {
    mockP2p = createMockWifiP2p();
    transport = new WiFiDirectTransport({ wifiP2p: mockP2p });
  });

  afterEach(async () => {
    try { await transport.stop(); } catch (e) {}
  });

  describe('start()', () => {
    it('initializes Wi-Fi P2P', async () => {
      await transport.start();
      expect(mockP2p.initialize).toHaveBeenCalled();
      expect(transport.isRunning).toBe(true);
    });

    it('throws if Wi-Fi Direct unavailable', async () => {
      mockP2p.isSuccessfulInitialize.mockResolvedValue(false);
      await expect(transport.start()).rejects.toThrow('not available');
    });

    it('is idempotent', async () => {
      await transport.start();
      await transport.start();
      expect(mockP2p.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop()', () => {
    it('stops and cleans up', async () => {
      await transport.start();
      await transport.stop();
      expect(transport.isRunning).toBe(false);
    });
  });

  describe('discovery', () => {
    it('starts and stops discovery', async () => {
      await transport.start();
      await transport.startDiscovery();
      expect(transport.isDiscovering).toBe(true);
      expect(mockP2p.discoverPeers).toHaveBeenCalled();

      await transport.stopDiscovery();
      expect(transport.isDiscovering).toBe(false);
    });
  });

  describe('connectToPeer()', () => {
    it('connects to a peer', async () => {
      await transport.start();
      const handler = jest.fn();
      transport.on('peerConnected', handler);

      await transport.connectToPeer('device-addr');
      expect(mockP2p.connect).toHaveBeenCalledWith('device-addr');
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ peerId: 'device-addr', transport: 'wifi-direct' })
      );
    });

    it('throws when not running', async () => {
      await expect(transport.connectToPeer('x')).rejects.toThrow('not running');
    });
  });

  describe('send()', () => {
    it('sends data to connected peer', async () => {
      await transport.start();
      await transport.connectToPeer('peer-1');
      await transport.send('peer-1', new Uint8Array([1, 2, 3]));
      expect(mockP2p.sendMessageTo).toHaveBeenCalled();
    });

    it('throws for unconnected peer', async () => {
      await transport.start();
      await expect(transport.send('unknown', new Uint8Array([1]))).rejects.toThrow();
    });
  });

  describe('broadcast()', () => {
    it('sends to all connected peers', async () => {
      await transport.start();
      await transport.connectToPeer('peer-1');
      const result = await transport.broadcast(new Uint8Array([1]));
      expect(result).toContain('peer-1');
    });
  });

  describe('getAvailablePeers()', () => {
    it('returns discovered peers', async () => {
      mockP2p.getAvailablePeers.mockResolvedValue([{ name: 'Device1' }]);
      await transport.start();
      const peers = await transport.getAvailablePeers();
      expect(peers).toHaveLength(1);
    });
  });
});
