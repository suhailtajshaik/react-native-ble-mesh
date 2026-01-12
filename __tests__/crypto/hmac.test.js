'use strict';

const { hmacSha256, verifyHmac, BLOCK_SIZE } = require('../../src/crypto/hmac');

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

describe('HMAC-SHA256', () => {
  describe('hmacSha256()', () => {
    // RFC 4231 Test Vectors for HMAC-SHA256
    test('RFC 4231 Test Case 1', () => {
      const key = hexToBytes('0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b');
      const data = new TextEncoder().encode('Hi There');
      const expected = 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7';

      const result = hmacSha256(key, data);
      expect(bytesToHex(result)).toBe(expected);
    });

    test('RFC 4231 Test Case 2 - key "Jefe"', () => {
      const key = new TextEncoder().encode('Jefe');
      const data = new TextEncoder().encode('what do ya want for nothing?');
      const expected = '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843';

      const result = hmacSha256(key, data);
      expect(bytesToHex(result)).toBe(expected);
    });

    test('RFC 4231 Test Case 3 - key and data 0xaa and 0xdd', () => {
      const key = new Uint8Array(20).fill(0xaa);
      const data = new Uint8Array(50).fill(0xdd);
      const expected = '773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe';

      const result = hmacSha256(key, data);
      expect(bytesToHex(result)).toBe(expected);
    });

    test('RFC 4231 Test Case 4 - incrementing key', () => {
      const key = hexToBytes('0102030405060708090a0b0c0d0e0f10111213141516171819');
      const data = new Uint8Array(50).fill(0xcd);
      const expected = '82558a389a443c0ea4cc819899f2083a85f0faa3e578f8077a2e3ff46729665b';

      const result = hmacSha256(key, data);
      expect(bytesToHex(result)).toBe(expected);
    });

    test('RFC 4231 Test Case 6 - large key (> block size)', () => {
      // Key larger than block size should be hashed first
      const key = new Uint8Array(131).fill(0xaa);
      const data = new TextEncoder().encode(
        'Test Using Larger Than Block-Size Key - Hash Key First'
      );
      const expected = '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54';

      const result = hmacSha256(key, data);
      expect(bytesToHex(result)).toBe(expected);
    });

    test('RFC 4231 Test Case 7 - large key and data', () => {
      const key = new Uint8Array(131).fill(0xaa);
      const data = new TextEncoder().encode(
        'This is a test using a larger than block-size key and a larger than block-size data. The key needs to be hashed before being used by the HMAC algorithm.'
      );
      const expected = '9b09ffa71b942fcb27635fbcd5b0e944bfdc63644f0713938a7f51535c3a35e2';

      const result = hmacSha256(key, data);
      expect(bytesToHex(result)).toBe(expected);
    });

    test('returns 32-byte Uint8Array', () => {
      const key = new Uint8Array(16);
      const data = new Uint8Array(10);
      const result = hmacSha256(key, data);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
    });

    test('empty data produces valid HMAC', () => {
      const key = new Uint8Array(32).fill(0x42);
      const data = new Uint8Array(0);
      const result = hmacSha256(key, data);

      expect(result.length).toBe(32);
    });

    test('empty key produces valid HMAC', () => {
      const key = new Uint8Array(0);
      const data = new TextEncoder().encode('test');
      const result = hmacSha256(key, data);

      expect(result.length).toBe(32);
    });

    test('throws TypeError for non-Uint8Array key', () => {
      expect(() => hmacSha256('key', new Uint8Array(0))).toThrow(TypeError);
      expect(() => hmacSha256(null, new Uint8Array(0))).toThrow(TypeError);
      expect(() => hmacSha256([1, 2, 3], new Uint8Array(0))).toThrow(TypeError);
    });

    test('throws TypeError for non-Uint8Array data', () => {
      expect(() => hmacSha256(new Uint8Array(0), 'data')).toThrow(TypeError);
      expect(() => hmacSha256(new Uint8Array(0), null)).toThrow(TypeError);
      expect(() => hmacSha256(new Uint8Array(0), [1, 2, 3])).toThrow(TypeError);
    });
  });

  describe('verifyHmac()', () => {
    test('returns true for valid MAC', () => {
      const key = new TextEncoder().encode('secret-key');
      const data = new TextEncoder().encode('message');
      const mac = hmacSha256(key, data);

      expect(verifyHmac(key, data, mac)).toBe(true);
    });

    test('returns false for invalid MAC', () => {
      const key = new TextEncoder().encode('secret-key');
      const data = new TextEncoder().encode('message');
      const invalidMac = new Uint8Array(32).fill(0);

      expect(verifyHmac(key, data, invalidMac)).toBe(false);
    });

    test('returns false for modified data', () => {
      const key = new TextEncoder().encode('secret-key');
      const data = new TextEncoder().encode('message');
      const mac = hmacSha256(key, data);
      const modifiedData = new TextEncoder().encode('modified');

      expect(verifyHmac(key, modifiedData, mac)).toBe(false);
    });

    test('returns false for wrong key', () => {
      const key = new TextEncoder().encode('secret-key');
      const wrongKey = new TextEncoder().encode('wrong-key');
      const data = new TextEncoder().encode('message');
      const mac = hmacSha256(key, data);

      expect(verifyHmac(wrongKey, data, mac)).toBe(false);
    });

    test('returns false for wrong length MAC', () => {
      const key = new TextEncoder().encode('secret-key');
      const data = new TextEncoder().encode('message');
      const shortMac = new Uint8Array(16);

      expect(verifyHmac(key, data, shortMac)).toBe(false);
    });

    test('returns false for non-Uint8Array MAC', () => {
      const key = new TextEncoder().encode('secret-key');
      const data = new TextEncoder().encode('message');

      expect(verifyHmac(key, data, null)).toBe(false);
      expect(verifyHmac(key, data, 'string')).toBe(false);
    });
  });

  describe('constants', () => {
    test('BLOCK_SIZE is 64', () => {
      expect(BLOCK_SIZE).toBe(64);
    });
  });

  describe('key handling', () => {
    test('key exactly block size works', () => {
      const key = new Uint8Array(BLOCK_SIZE).fill(0x42);
      const data = new TextEncoder().encode('test');
      const result = hmacSha256(key, data);

      expect(result.length).toBe(32);
    });

    test('key one byte less than block size works', () => {
      const key = new Uint8Array(BLOCK_SIZE - 1).fill(0x42);
      const data = new TextEncoder().encode('test');
      const result = hmacSha256(key, data);

      expect(result.length).toBe(32);
    });

    test('key one byte more than block size triggers hashing', () => {
      const key = new Uint8Array(BLOCK_SIZE + 1).fill(0x42);
      const data = new TextEncoder().encode('test');
      const result = hmacSha256(key, data);

      expect(result.length).toBe(32);
    });
  });
});
