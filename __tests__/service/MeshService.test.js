'use strict';

const { MeshService } = require('../../src/service');
const { MockTransport } = require('../../src/transport');
const { MemoryStorage } = require('../../src/storage');

describe('MeshService', () => {
  let service;
  let transport;

  beforeEach(() => {
    service = new MeshService({ displayName: 'TestNode' });
    transport = new MockTransport({ localPeerId: 'test-peer' });
  });

  afterEach(async () => {
    try { await service.destroy(); } catch (e) {}
  });

  describe('initialize()', () => {
    it('initializes successfully', async () => {
      await service.initialize({ storage: new MemoryStorage() });
      expect(service._state).toBe('ready');
    });

    it('throws if already initialized', async () => {
      await service.initialize({ storage: new MemoryStorage() });
      await expect(service.initialize({})).rejects.toThrow('already initialized');
    });
  });

  describe('start()', () => {
    it('starts with transport', async () => {
      await service.initialize({ storage: new MemoryStorage() });
      await service.start(transport);
      expect(service._state).toBe('active');
    });

    it('throws without transport', async () => {
      await service.initialize({ storage: new MemoryStorage() });
      await expect(service.start()).rejects.toThrow();
    });
  });

  describe('stop()', () => {
    it('stops active service', async () => {
      await service.initialize({ storage: new MemoryStorage() });
      await service.start(transport);
      await service.stop();
      expect(service._state).toBe('suspended');
    });

    it('is safe when not active', async () => {
      await service.stop(); // should not throw
    });
  });

  describe('destroy()', () => {
    it('destroys initialized service', async () => {
      await service.initialize({ storage: new MemoryStorage() });
      await service.start(transport);
      await service.destroy();
      expect(service._state).toBe('destroyed');
    });
  });

  describe('identity', () => {
    it('returns identity', async () => {
      await service.initialize({ storage: new MemoryStorage() });
      const identity = service.getIdentity();
      expect(identity).toHaveProperty('displayName', 'TestNode');
      expect(identity).toHaveProperty('publicKey');
    });

    it('updates display name', () => {
      service.setDisplayName('NewName');
      expect(service._config.displayName).toBe('NewName');
    });
  });

  describe('peers', () => {
    it('returns empty peers initially', () => {
      expect(service.getPeers()).toEqual([]);
    });

    it('returns empty connected peers', () => {
      expect(service.getConnectedPeers()).toEqual([]);
    });

    it('returns empty secured peers', () => {
      expect(service.getSecuredPeers()).toEqual([]);
    });
  });

  describe('messaging', () => {
    beforeEach(async () => {
      await service.initialize({ storage: new MemoryStorage() });
      await service.start(transport);
    });

    it('sends broadcast', async () => {
      const msgId = await service.sendBroadcast('Hello world');
      expect(msgId).toBeTruthy();
    });
  });
});
