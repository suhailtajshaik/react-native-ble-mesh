'use strict';

const { extract, expand, derive, deriveMultiple, HASH_LENGTH, MAX_OUTPUT_LENGTH } = require('../../src/crypto/hkdf');

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

describe('HKDF', () => {
  describe('RFC 5869 Test Vectors (SHA-256)', () => {
    test('Test Case 1', () => {
      const ikm = hexToBytes('0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b');
      const salt = hexToBytes('000102030405060708090a0b0c');
      const info = hexToBytes('f0f1f2f3f4f5f6f7f8f9');
      const expectedPrk = '077709362c2e32df0ddc3f0dc47bba6390b6c73bb50f9c3122ec844ad7c2b3e5';
      const expectedOkm = '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865';

      const prk = extract(salt, ikm);
      expect(bytesToHex(prk)).toBe(expectedPrk);

      const okm = expand(prk, info, 42);
      expect(bytesToHex(okm)).toBe(expectedOkm);
    });

    test('Test Case 2 - longer inputs', () => {
      const ikm = hexToBytes('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f');
      const salt = hexToBytes('606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeaf');
      const info = hexToBytes('b0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff');
      const expectedPrk = '06a6b88c5853361a06104c9ceb35b45cef760014904671014a193f40c15fc244';
      const expectedOkm = 'b11e398dc80327a1c8e7f78c596a49344f012eda2d4efad8a050cc4c19afa97c59045a99cac7827271cb41c65e590e09da3275600c2f09b8367793a9aca3db71cc30c58179ec3e87c14c01d5c1f3434f1d87';

      const prk = extract(salt, ikm);
      expect(bytesToHex(prk)).toBe(expectedPrk);

      const okm = expand(prk, info, 82);
      expect(bytesToHex(okm)).toBe(expectedOkm);
    });

    test('Test Case 3 - zero-length salt and info', () => {
      const ikm = hexToBytes('0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b');
      const salt = new Uint8Array(0);
      const info = new Uint8Array(0);
      const expectedPrk = '19ef24a32c717b167f33a91d6f648bdf96596776afdb6377ac434c1c293ccb04';
      const expectedOkm = '8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8';

      const prk = extract(salt, ikm);
      expect(bytesToHex(prk)).toBe(expectedPrk);

      const okm = expand(prk, info, 42);
      expect(bytesToHex(okm)).toBe(expectedOkm);
    });
  });

  describe('extract()', () => {
    test('returns 32-byte PRK', () => {
      const salt = new Uint8Array(16);
      const ikm = new Uint8Array(32);
      const prk = extract(salt, ikm);

      expect(prk).toBeInstanceOf(Uint8Array);
      expect(prk.length).toBe(32);
    });

    test('null salt uses default zero salt', () => {
      const ikm = new Uint8Array(32).fill(0x42);
      const prk1 = extract(null, ikm);
      const prk2 = extract(new Uint8Array(32), ikm);

      expect(bytesToHex(prk1)).toBe(bytesToHex(prk2));
    });

    test('empty salt uses default zero salt', () => {
      const ikm = new Uint8Array(32).fill(0x42);
      const prk1 = extract(new Uint8Array(0), ikm);
      const prk2 = extract(new Uint8Array(32), ikm);

      expect(bytesToHex(prk1)).toBe(bytesToHex(prk2));
    });

    test('throws TypeError for non-Uint8Array ikm', () => {
      expect(() => extract(new Uint8Array(0), 'string')).toThrow(TypeError);
      expect(() => extract(new Uint8Array(0), null)).toThrow(TypeError);
    });
  });

  describe('expand()', () => {
    test('returns requested length', () => {
      const prk = new Uint8Array(32);
      const info = new Uint8Array(0);

      expect(expand(prk, info, 16).length).toBe(16);
      expect(expand(prk, info, 32).length).toBe(32);
      expect(expand(prk, info, 64).length).toBe(64);
      expect(expand(prk, info, 100).length).toBe(100);
    });

    test('length 0 returns empty array', () => {
      const prk = new Uint8Array(32);
      const info = new Uint8Array(0);
      const result = expand(prk, info, 0);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(0);
    });

    test('throws RangeError for length > max', () => {
      const prk = new Uint8Array(32);
      const info = new Uint8Array(0);

      expect(() => expand(prk, info, MAX_OUTPUT_LENGTH + 1)).toThrow(RangeError);
    });

    test('throws TypeError for negative length', () => {
      const prk = new Uint8Array(32);
      const info = new Uint8Array(0);

      expect(() => expand(prk, info, -1)).toThrow(TypeError);
    });

    test('throws TypeError for non-integer length', () => {
      const prk = new Uint8Array(32);
      const info = new Uint8Array(0);

      expect(() => expand(prk, info, 10.5)).toThrow(TypeError);
    });

    test('throws TypeError for non-Uint8Array prk', () => {
      expect(() => expand('string', new Uint8Array(0), 32)).toThrow(TypeError);
    });

    test('throws TypeError for non-Uint8Array info', () => {
      expect(() => expand(new Uint8Array(32), 'string', 32)).toThrow(TypeError);
    });

    test('different info produces different output', () => {
      const prk = new Uint8Array(32).fill(0x42);
      const info1 = new TextEncoder().encode('context1');
      const info2 = new TextEncoder().encode('context2');

      const okm1 = expand(prk, info1, 32);
      const okm2 = expand(prk, info2, 32);

      expect(bytesToHex(okm1)).not.toBe(bytesToHex(okm2));
    });
  });

  describe('derive()', () => {
    test('combines extract and expand', () => {
      const ikm = hexToBytes('0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b');
      const salt = hexToBytes('000102030405060708090a0b0c');
      const info = hexToBytes('f0f1f2f3f4f5f6f7f8f9');

      const combined = derive(ikm, salt, info, 42);
      const expectedOkm = '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865';

      expect(bytesToHex(combined)).toBe(expectedOkm);
    });

    test('works with null salt', () => {
      const ikm = new Uint8Array(32).fill(0x42);
      const info = new TextEncoder().encode('test');
      const result = derive(ikm, null, info, 32);

      expect(result.length).toBe(32);
    });
  });

  describe('deriveMultiple()', () => {
    test('derives multiple keys at once', () => {
      const ikm = new Uint8Array(32).fill(0x42);
      const info = new TextEncoder().encode('keys');
      const [key1, key2, key3] = deriveMultiple(ikm, null, info, [32, 16, 24]);

      expect(key1.length).toBe(32);
      expect(key2.length).toBe(16);
      expect(key3.length).toBe(24);
    });

    test('concatenated keys equal single derivation', () => {
      const ikm = new Uint8Array(32).fill(0x42);
      const info = new TextEncoder().encode('keys');

      const [key1, key2] = deriveMultiple(ikm, null, info, [32, 32]);
      const combined = derive(ikm, null, info, 64);

      expect(bytesToHex(key1)).toBe(bytesToHex(combined.subarray(0, 32)));
      expect(bytesToHex(key2)).toBe(bytesToHex(combined.subarray(32, 64)));
    });

    test('throws TypeError for non-array lengths', () => {
      const ikm = new Uint8Array(32);
      expect(() => deriveMultiple(ikm, null, new Uint8Array(0), 32)).toThrow(TypeError);
    });

    test('throws TypeError for empty lengths array', () => {
      const ikm = new Uint8Array(32);
      expect(() => deriveMultiple(ikm, null, new Uint8Array(0), [])).toThrow(TypeError);
    });
  });

  describe('constants', () => {
    test('HASH_LENGTH is 32', () => {
      expect(HASH_LENGTH).toBe(32);
    });

    test('MAX_OUTPUT_LENGTH is 255 * 32', () => {
      expect(MAX_OUTPUT_LENGTH).toBe(255 * 32);
      expect(MAX_OUTPUT_LENGTH).toBe(8160);
    });
  });
});
