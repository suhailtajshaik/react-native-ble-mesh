'use strict';

const JitterBuffer = require('../../../../src/service/audio/buffer/JitterBuffer');

describe('JitterBuffer', () => {
  describe('constructor', () => {
    test('creates buffer with default depth', () => {
      const buffer = new JitterBuffer();
      expect(buffer.getBufferLevel()).toBe(0);
    });

    test('accepts custom depth', () => {
      const buffer = new JitterBuffer({ depth: 10 });
      expect(buffer.getStats().targetDepth).toBe(10);
    });
  });

  describe('push()', () => {
    test('adds frame to buffer', () => {
      const buffer = new JitterBuffer();
      const frame = new Uint8Array([1, 2, 3]);

      buffer.push(frame, 0);

      expect(buffer.getBufferLevel()).toBe(1);
    });

    test('handles out-of-order frames', () => {
      const buffer = new JitterBuffer();

      buffer.push(new Uint8Array([1]), 0);
      buffer.push(new Uint8Array([3]), 2);
      buffer.push(new Uint8Array([2]), 1);

      expect(buffer.getBufferLevel()).toBe(3);
    });

    test('drops duplicate sequence numbers', () => {
      const buffer = new JitterBuffer();

      buffer.push(new Uint8Array([1]), 0);
      buffer.push(new Uint8Array([1]), 0); // Duplicate

      expect(buffer.getBufferLevel()).toBe(1);
    });

    test('drops frames older than next play sequence', () => {
      const buffer = new JitterBuffer();

      buffer.push(new Uint8Array([1]), 5);
      buffer.pop(); // Advances to seq 6

      buffer.push(new Uint8Array([2]), 4); // Too old

      expect(buffer.getStats().framesDropped).toBe(1);
    });

    test('emits overflow on buffer full', () => {
      const buffer = new JitterBuffer({ maxDepth: 3 });
      const handler = jest.fn();
      buffer.on('overflow', handler);

      for (let i = 0; i < 5; i++) {
        buffer.push(new Uint8Array([i]), i);
      }

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('pop()', () => {
    test('returns frame in sequence order', () => {
      const buffer = new JitterBuffer();

      buffer.push(new Uint8Array([1]), 0);
      buffer.push(new Uint8Array([2]), 1);

      const first = buffer.pop();
      const second = buffer.pop();

      expect(first.sequenceNumber).toBe(0);
      expect(second.sequenceNumber).toBe(1);
      expect(first.isPLC).toBe(false);
      expect(second.isPLC).toBe(false);
    });

    test('returns PLC marker for missing frame', () => {
      const buffer = new JitterBuffer();

      // Buffer initializes from first received sequence
      buffer.push(new Uint8Array([1]), 0);
      buffer.push(new Uint8Array([3]), 2); // Skip sequence 1

      const first = buffer.pop();  // seq 0, has frame
      const second = buffer.pop(); // seq 1, missing - PLC
      const third = buffer.pop();  // seq 2, has frame

      expect(first.isPLC).toBe(false);
      expect(first.frame).toEqual(new Uint8Array([1]));
      expect(second.isPLC).toBe(true);
      expect(second.frame).toBeNull();
      expect(third.isPLC).toBe(false);
      expect(third.frame).toEqual(new Uint8Array([3]));
    });

    test('emits underrun when empty', () => {
      const buffer = new JitterBuffer();
      const handler = jest.fn();
      buffer.on('underrun', handler);

      buffer.push(new Uint8Array([1]), 0);
      buffer.pop();
      buffer.pop(); // Buffer empty

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('getBufferLevel()', () => {
    test('returns current buffer level', () => {
      const buffer = new JitterBuffer();

      expect(buffer.getBufferLevel()).toBe(0);

      buffer.push(new Uint8Array([1]), 0);
      buffer.push(new Uint8Array([2]), 1);

      expect(buffer.getBufferLevel()).toBe(2);

      buffer.pop();

      expect(buffer.getBufferLevel()).toBe(1);
    });
  });

  describe('isReady()', () => {
    test('returns true when buffer has enough frames', () => {
      const buffer = new JitterBuffer({ depth: 3 });

      expect(buffer.isReady()).toBe(false);

      buffer.push(new Uint8Array([1]), 0);
      buffer.push(new Uint8Array([2]), 1);
      buffer.push(new Uint8Array([3]), 2);

      expect(buffer.isReady()).toBe(true);
    });
  });

  describe('getStats()', () => {
    test('tracks statistics', () => {
      const buffer = new JitterBuffer();

      buffer.push(new Uint8Array([1]), 0);
      buffer.push(new Uint8Array([2]), 2); // Skip 1
      buffer.pop();
      buffer.pop(); // PLC for missing 1
      buffer.pop();

      const stats = buffer.getStats();

      expect(stats.framesReceived).toBe(2);
      expect(stats.framesPlayed).toBe(2);
      expect(stats.plcFrames).toBe(1);
    });
  });

  describe('clear()', () => {
    test('resets the buffer', () => {
      const buffer = new JitterBuffer();

      buffer.push(new Uint8Array([1]), 0);
      buffer.push(new Uint8Array([2]), 1);

      buffer.clear();

      expect(buffer.getBufferLevel()).toBe(0);
    });
  });
});
