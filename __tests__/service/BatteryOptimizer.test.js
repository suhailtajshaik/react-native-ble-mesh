'use strict';

const { BatteryOptimizer, BATTERY_MODE } = require('../../src/service/BatteryOptimizer');

describe('BatteryOptimizer', () => {
  let optimizer;

  beforeEach(() => {
    optimizer = new BatteryOptimizer();
  });

  afterEach(() => {
    optimizer.destroy();
  });

  describe('constructor', () => {
    it('creates with default balanced mode', () => {
      expect(optimizer.getMode()).toBe(BATTERY_MODE.BALANCED);
    });

    it('accepts initial mode', () => {
      const opt = new BatteryOptimizer({ initialMode: BATTERY_MODE.LOW_POWER });
      expect(opt.getMode()).toBe(BATTERY_MODE.LOW_POWER);
      opt.destroy();
    });
  });

  describe('setMode()', () => {
    it('switches to high performance mode', async () => {
      await optimizer.setMode(BATTERY_MODE.HIGH_PERFORMANCE);
      expect(optimizer.getMode()).toBe(BATTERY_MODE.HIGH_PERFORMANCE);
    });

    it('switches to low power mode', async () => {
      await optimizer.setMode(BATTERY_MODE.LOW_POWER);
      expect(optimizer.getMode()).toBe(BATTERY_MODE.LOW_POWER);
    });

    it('switches to auto mode', async () => {
      await optimizer.setMode(BATTERY_MODE.AUTO);
      expect(optimizer.getMode()).toBe(BATTERY_MODE.AUTO);
    });
  });

  describe('updateBatteryLevel()', () => {
    it('accepts battery level', () => {
      expect(() => optimizer.updateBatteryLevel(50)).not.toThrow();
    });

    it('accepts charging state', () => {
      expect(() => optimizer.updateBatteryLevel(80, true)).not.toThrow();
    });
  });

  describe('setTransport()', () => {
    it('accepts a transport', () => {
      const mockTransport = { setPowerMode: jest.fn() };
      expect(() => optimizer.setTransport(mockTransport)).not.toThrow();
    });
  });

  describe('destroy()', () => {
    it('cleans up without error', () => {
      expect(() => optimizer.destroy()).not.toThrow();
    });

    it('is idempotent', () => {
      optimizer.destroy();
      optimizer.destroy(); // should not throw
    });
  });

  describe('BATTERY_MODE constants', () => {
    it('has expected modes', () => {
      expect(BATTERY_MODE.HIGH_PERFORMANCE).toBeDefined();
      expect(BATTERY_MODE.BALANCED).toBeDefined();
      expect(BATTERY_MODE.LOW_POWER).toBeDefined();
      expect(BATTERY_MODE.AUTO).toBeDefined();
    });
  });
});
