'use strict';

const { MeshNetwork, BATTERY_MODE, PANIC_TRIGGER, HEALTH_STATUS } = require('../../src/MeshNetwork');
const { MockTransport } = require('../../src/transport');

describe('MeshNetwork Unit Tests', () => {
  describe('constructor', () => {
    it('creates with defaults', () => {
      const mesh = new MeshNetwork();
      expect(mesh).toBeDefined();
      expect(mesh._config.nickname).toBe('Anonymous');
    });

    it('merges config with defaults', () => {
      const mesh = new MeshNetwork({
        nickname: 'Test',
        batteryMode: 'low',
        routing: { maxHops: 3 },
      });
      expect(mesh._config.nickname).toBe('Test');
      expect(mesh._config.routing.maxHops).toBe(3);
      expect(mesh._config.routing.bloomFilterSize).toBe(10000); // default preserved
    });

    it('deep merges nested config', () => {
      const mesh = new MeshNetwork({
        encryption: { level: 'high' },
      });
      expect(mesh._config.encryption.level).toBe('high');
      expect(mesh._config.encryption.rotateKeysAfter).toBe(1000); // default
    });
  });

  describe('constants', () => {
    it('exposes BATTERY_MODE', () => {
      expect(BATTERY_MODE).toBeDefined();
      expect(BATTERY_MODE.BALANCED).toBeDefined();
    });

    it('exposes HEALTH_STATUS', () => {
      expect(HEALTH_STATUS).toBeDefined();
    });

    it('exposes static constants on class', () => {
      expect(MeshNetwork.BatteryMode).toBe(BATTERY_MODE);
      expect(MeshNetwork.PanicTrigger).toBe(PANIC_TRIGGER);
    });
  });

  describe('_normalizeChannelName()', () => {
    let mesh;
    beforeEach(() => { mesh = new MeshNetwork(); });

    it('adds # prefix if missing', () => {
      expect(mesh._normalizeChannelName('general')).toBe('#general');
    });

    it('keeps existing # prefix', () => {
      expect(mesh._normalizeChannelName('#general')).toBe('#general');
    });
  });

  describe('_validateMessageText()', () => {
    let mesh;
    beforeEach(() => { mesh = new MeshNetwork(); });

    it('rejects null', () => {
      expect(() => mesh._validateMessageText(null)).toThrow();
    });

    it('rejects undefined', () => {
      expect(() => mesh._validateMessageText(undefined)).toThrow();
    });

    it('rejects non-string', () => {
      expect(() => mesh._validateMessageText(123)).toThrow();
    });

    it('rejects empty string', () => {
      expect(() => mesh._validateMessageText('')).toThrow();
    });

    it('accepts valid text', () => {
      expect(() => mesh._validateMessageText('hello')).not.toThrow();
    });

    it('rejects oversized messages', () => {
      const huge = 'x'.repeat(1024 * 1024 + 1);
      expect(() => mesh._validateMessageText(huge)).toThrow();
    });
  });

  describe('_validatePeerId()', () => {
    let mesh;
    beforeEach(() => { mesh = new MeshNetwork(); });

    it('rejects null', () => {
      expect(() => mesh._validatePeerId(null)).toThrow();
    });

    it('rejects non-string', () => {
      expect(() => mesh._validatePeerId(42)).toThrow();
    });

    it('rejects whitespace-only', () => {
      expect(() => mesh._validatePeerId('   ')).toThrow();
    });

    it('accepts valid peer ID', () => {
      expect(() => mesh._validatePeerId('peer-123')).not.toThrow();
    });
  });

  describe('_validateRunning()', () => {
    it('throws when not running', () => {
      const mesh = new MeshNetwork();
      expect(() => mesh._validateRunning()).toThrow('not running');
    });

    it('does not throw when running', async () => {
      const mesh = new MeshNetwork();
      const transport = new MockTransport();
      await mesh.start(transport);
      expect(() => mesh._validateRunning()).not.toThrow();
      await mesh.destroy();
    });
  });

  describe('lifecycle', () => {
    it('starts and stops', async () => {
      const mesh = new MeshNetwork({ nickname: 'Test' });
      const transport = new MockTransport();
      await mesh.start(transport);
      expect(mesh.getStatus().state).toBe('running');
      await mesh.stop();
      expect(mesh.getStatus().state).toBe('stopped');
    });

    it('can restart after stop', async () => {
      const mesh = new MeshNetwork({ nickname: 'Test' });
      const transport = new MockTransport();
      await mesh.start(transport);
      await mesh.stop();
      await mesh.start(transport);
      expect(mesh.getStatus().state).toBe('running');
      await mesh.destroy();
    });

    it('destroy cleans up', async () => {
      const mesh = new MeshNetwork();
      const transport = new MockTransport();
      await mesh.start(transport);
      await mesh.destroy();
      expect(mesh.getStatus().state).toBe('stopped');
    });

    it('start is idempotent', async () => {
      const mesh = new MeshNetwork();
      const transport = new MockTransport();
      await mesh.start(transport);
      await mesh.start(transport); // should not throw
      await mesh.destroy();
    });
  });

  describe('getStatus()', () => {
    it('returns status object', async () => {
      const mesh = new MeshNetwork({ nickname: 'Alice' });
      const transport = new MockTransport();
      await mesh.start(transport);
      const status = mesh.getStatus();
      expect(status).toHaveProperty('state', 'running');
      expect(status).toHaveProperty('peers');
      expect(status).toHaveProperty('health');
      expect(status).toHaveProperty('batteryMode');
      await mesh.destroy();
    });
  });

  describe('setNickname()', () => {
    it('updates nickname', () => {
      const mesh = new MeshNetwork({ nickname: 'Old' });
      mesh.setNickname('New');
      expect(mesh._config.nickname).toBe('New');
    });
  });
});
