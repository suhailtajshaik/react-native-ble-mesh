'use strict';

const FrameBuffer = require('../../../../src/service/audio/buffer/FrameBuffer');

describe('FrameBuffer', () => {
  describe('push()', () => {
    test('adds frame to buffer', () => {
      const buffer = new FrameBuffer();
      const frame = new Uint8Array([1, 2, 3]);

      const added = buffer.push(frame);

      expect(added).toBe(true);
      expect(buffer.getFrameCount()).toBe(1);
      expect(buffer.getTotalBytes()).toBe(3);
    });

    test('rejects when max bytes exceeded', () => {
      const buffer = new FrameBuffer({ maxBytes: 10 });

      buffer.push(new Uint8Array(5));
      buffer.push(new Uint8Array(4));
      const added = buffer.push(new Uint8Array(3)); // Would exceed

      expect(added).toBe(false);
      expect(buffer.getFrameCount()).toBe(2);
    });

    test('rejects when max frames exceeded', () => {
      const buffer = new FrameBuffer({ maxFrames: 2 });

      buffer.push(new Uint8Array([1]));
      buffer.push(new Uint8Array([2]));
      const added = buffer.push(new Uint8Array([3])); // Exceeds max

      expect(added).toBe(false);
      expect(buffer.getFrameCount()).toBe(2);
    });
  });

  describe('getFrame()', () => {
    test('returns frame by index', () => {
      const buffer = new FrameBuffer();

      buffer.push(new Uint8Array([1, 2]));
      buffer.push(new Uint8Array([3, 4]));

      expect(buffer.getFrame(0)).toEqual(new Uint8Array([1, 2]));
      expect(buffer.getFrame(1)).toEqual(new Uint8Array([3, 4]));
    });

    test('returns null for invalid index', () => {
      const buffer = new FrameBuffer();

      buffer.push(new Uint8Array([1]));

      expect(buffer.getFrame(-1)).toBeNull();
      expect(buffer.getFrame(5)).toBeNull();
    });
  });

  describe('getDurationMs()', () => {
    test('calculates duration based on frame count', () => {
      const buffer = new FrameBuffer();

      buffer.push(new Uint8Array([1]));
      buffer.push(new Uint8Array([2]));
      buffer.push(new Uint8Array([3]));

      expect(buffer.getDurationMs(10)).toBe(30); // 3 frames * 10ms
      expect(buffer.getDurationMs(7.5)).toBe(22.5); // 3 frames * 7.5ms
    });
  });

  describe('serialize() / deserialize()', () => {
    test('round-trips frames correctly', () => {
      const buffer = new FrameBuffer();

      buffer.push(new Uint8Array([1, 2, 3]));
      buffer.push(new Uint8Array([4, 5]));
      buffer.push(new Uint8Array([6, 7, 8, 9]));

      const serialized = buffer.serialize();
      const restored = FrameBuffer.deserialize(serialized);

      expect(restored.getFrameCount()).toBe(3);
      expect(restored.getFrame(0)).toEqual(new Uint8Array([1, 2, 3]));
      expect(restored.getFrame(1)).toEqual(new Uint8Array([4, 5]));
      expect(restored.getFrame(2)).toEqual(new Uint8Array([6, 7, 8, 9]));
    });
  });

  describe('toArray()', () => {
    test('returns copy of all frames', () => {
      const buffer = new FrameBuffer();

      buffer.push(new Uint8Array([1]));
      buffer.push(new Uint8Array([2]));

      const frames = buffer.toArray();

      expect(frames.length).toBe(2);
      expect(frames[0]).toEqual(new Uint8Array([1]));
      expect(frames[1]).toEqual(new Uint8Array([2]));
    });
  });

  describe('clear()', () => {
    test('removes all frames', () => {
      const buffer = new FrameBuffer();

      buffer.push(new Uint8Array([1]));
      buffer.push(new Uint8Array([2]));

      buffer.clear();

      expect(buffer.getFrameCount()).toBe(0);
      expect(buffer.getTotalBytes()).toBe(0);
    });
  });

  describe('iterator', () => {
    test('allows iteration over frames', () => {
      const buffer = new FrameBuffer();

      buffer.push(new Uint8Array([1]));
      buffer.push(new Uint8Array([2]));
      buffer.push(new Uint8Array([3]));

      const frames = [...buffer];

      expect(frames.length).toBe(3);
    });
  });
});
