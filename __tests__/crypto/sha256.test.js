'use strict';

const { hash, createHash, HashContext } = require('../../src/crypto/sha256');

/**
 * Convert hex string to Uint8Array
 * @param {string} hex - Hex string
 * @returns {Uint8Array}
 */
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('SHA-256', () => {
  describe('hash()', () => {
    test('empty input produces correct hash', () => {
      const result = hash(new Uint8Array(0));
      const expected = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      expect(bytesToHex(result)).toBe(expected);
    });

    test('FIPS 180-4 test vector: "abc"', () => {
      const input = new TextEncoder().encode('abc');
      const result = hash(input);
      const expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
      expect(bytesToHex(result)).toBe(expected);
    });

    test('FIPS 180-4 test vector: 448-bit message', () => {
      const input = new TextEncoder().encode(
        'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'
      );
      const result = hash(input);
      const expected = '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1';
      expect(bytesToHex(result)).toBe(expected);
    });

    test('single byte input', () => {
      const input = new Uint8Array([0x61]); // 'a'
      const result = hash(input);
      const expected = 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb';
      expect(bytesToHex(result)).toBe(expected);
    });

    test('exactly 64 bytes (one block)', () => {
      const input = new Uint8Array(64).fill(0x61); // 64 'a's
      const result = hash(input);
      expect(result.length).toBe(32);
    });

    test('65 bytes (spans two blocks)', () => {
      const input = new Uint8Array(65).fill(0x61);
      const result = hash(input);
      expect(result.length).toBe(32);
    });

    test('returns 32-byte Uint8Array', () => {
      const result = hash(new Uint8Array([1, 2, 3]));
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
    });
  });

  describe('createHash() streaming', () => {
    test('produces same result as hash()', () => {
      const data = new TextEncoder().encode('Hello, World!');
      const oneShot = hash(data);
      const streaming = createHash().update(data).digest();
      expect(bytesToHex(streaming)).toBe(bytesToHex(oneShot));
    });

    test('allows multiple updates', () => {
      const ctx = createHash();
      ctx.update(new TextEncoder().encode('Hello, '));
      ctx.update(new TextEncoder().encode('World!'));
      const result = ctx.digest();

      const expected = hash(new TextEncoder().encode('Hello, World!'));
      expect(bytesToHex(result)).toBe(bytesToHex(expected));
    });

    test('handles empty updates', () => {
      const ctx = createHash();
      ctx.update(new Uint8Array(0));
      ctx.update(new TextEncoder().encode('abc'));
      ctx.update(new Uint8Array(0));
      const result = ctx.digest();

      const expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
      expect(bytesToHex(result)).toBe(expected);
    });

    test('throws if update called after digest', () => {
      const ctx = createHash();
      ctx.update(new Uint8Array([1]));
      ctx.digest();
      expect(() => ctx.update(new Uint8Array([2]))).toThrow();
    });

    test('throws if digest called twice', () => {
      const ctx = createHash();
      ctx.update(new Uint8Array([1]));
      ctx.digest();
      expect(() => ctx.digest()).toThrow();
    });

    test('update returns context for chaining', () => {
      const ctx = createHash();
      const returned = ctx.update(new Uint8Array([1]));
      expect(returned).toBe(ctx);
    });
  });

  describe('HashContext', () => {
    test('can be instantiated directly', () => {
      const ctx = new HashContext();
      expect(ctx).toBeInstanceOf(HashContext);
    });
  });

  describe('large inputs', () => {
    test('handles 1MB input', () => {
      const input = new Uint8Array(1024 * 1024).fill(0x42);
      const result = hash(input);
      expect(result.length).toBe(32);
    });

    test('streaming large input in chunks', () => {
      const chunkSize = 1000;
      const totalSize = 10000;
      const fullData = new Uint8Array(totalSize).fill(0x42);

      // One-shot hash
      const oneShot = hash(fullData);

      // Streaming in chunks
      const ctx = createHash();
      for (let i = 0; i < totalSize; i += chunkSize) {
        ctx.update(fullData.subarray(i, Math.min(i + chunkSize, totalSize)));
      }
      const streaming = ctx.digest();

      expect(bytesToHex(streaming)).toBe(bytesToHex(oneShot));
    });
  });
});
