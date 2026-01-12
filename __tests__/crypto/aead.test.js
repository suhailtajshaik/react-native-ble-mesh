'use strict';

/**
 * @fileoverview Tests for ChaCha20-Poly1305 AEAD (RFC 8439)
 */

const { encrypt, decrypt } = require('../../src/crypto/aead');

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

describe('ChaCha20-Poly1305 AEAD', () => {
  describe('encrypt()', () => {
    test('encrypts empty plaintext', () => {
      const key = new Uint8Array(32).fill(0x42);
      const nonce = new Uint8Array(12).fill(0x24);
      const plaintext = new Uint8Array(0);

      const ciphertext = encrypt(key, nonce, plaintext);
      // Should only contain 16-byte tag for empty plaintext
      expect(ciphertext.length).toBe(16);
    });

    test('encrypts simple message', () => {
      const key = new Uint8Array(32).fill(0x01);
      const nonce = new Uint8Array(12).fill(0x02);
      const plaintext = new TextEncoder().encode('Hello, World!');

      const ciphertext = encrypt(key, nonce, plaintext);
      // Ciphertext = plaintext length + 16-byte tag
      expect(ciphertext.length).toBe(plaintext.length + 16);
    });

    test('produces different output for different keys', () => {
      const key1 = new Uint8Array(32).fill(0x01);
      const key2 = new Uint8Array(32).fill(0x02);
      const nonce = new Uint8Array(12).fill(0x00);
      const plaintext = new TextEncoder().encode('Test message');

      const ct1 = encrypt(key1, nonce, plaintext);
      const ct2 = encrypt(key2, nonce, plaintext);

      expect(bytesToHex(ct1)).not.toBe(bytesToHex(ct2));
    });

    test('produces different output for different nonces', () => {
      const key = new Uint8Array(32).fill(0x01);
      const nonce1 = new Uint8Array(12).fill(0x00);
      const nonce2 = new Uint8Array(12).fill(0x01);
      const plaintext = new TextEncoder().encode('Test message');

      const ct1 = encrypt(key, nonce1, plaintext);
      const ct2 = encrypt(key, nonce2, plaintext);

      expect(bytesToHex(ct1)).not.toBe(bytesToHex(ct2));
    });

    test('includes AAD in authentication', () => {
      const key = new Uint8Array(32).fill(0x01);
      const nonce = new Uint8Array(12).fill(0x02);
      const plaintext = new TextEncoder().encode('Message');
      const aad1 = new TextEncoder().encode('header1');
      const aad2 = new TextEncoder().encode('header2');

      const ct1 = encrypt(key, nonce, plaintext, aad1);
      const ct2 = encrypt(key, nonce, plaintext, aad2);

      // Same key, nonce, plaintext but different AAD produces different tags
      expect(bytesToHex(ct1)).not.toBe(bytesToHex(ct2));
    });

    test('throws for invalid key length', () => {
      const key = new Uint8Array(16); // Wrong size
      const nonce = new Uint8Array(12);
      const plaintext = new Uint8Array(10);

      expect(() => encrypt(key, nonce, plaintext)).toThrow('Key must be 32 bytes');
    });

    test('throws for invalid nonce length', () => {
      const key = new Uint8Array(32);
      const nonce = new Uint8Array(8); // Wrong size
      const plaintext = new Uint8Array(10);

      expect(() => encrypt(key, nonce, plaintext)).toThrow('Nonce must be 12 bytes');
    });

    test('throws for non-Uint8Array plaintext', () => {
      const key = new Uint8Array(32);
      const nonce = new Uint8Array(12);

      expect(() => encrypt(key, nonce, 'string')).toThrow('Plaintext must be a Uint8Array');
    });

    test('throws for non-Uint8Array AAD', () => {
      const key = new Uint8Array(32);
      const nonce = new Uint8Array(12);
      const plaintext = new Uint8Array(10);

      expect(() => encrypt(key, nonce, plaintext, 'string')).toThrow('AAD must be a Uint8Array');
    });
  });

  describe('decrypt()', () => {
    test('decrypts valid ciphertext', () => {
      const key = new Uint8Array(32).fill(0x42);
      const nonce = new Uint8Array(12).fill(0x24);
      const original = new TextEncoder().encode('Hello, World!');

      const ciphertext = encrypt(key, nonce, original);
      const decrypted = decrypt(key, nonce, ciphertext);

      expect(decrypted).not.toBeNull();
      expect(bytesToHex(decrypted)).toBe(bytesToHex(original));
    });

    test('decrypts empty plaintext', () => {
      const key = new Uint8Array(32).fill(0x01);
      const nonce = new Uint8Array(12).fill(0x02);
      const original = new Uint8Array(0);

      const ciphertext = encrypt(key, nonce, original);
      const decrypted = decrypt(key, nonce, ciphertext);

      expect(decrypted).not.toBeNull();
      expect(decrypted.length).toBe(0);
    });

    test('decrypts with AAD', () => {
      const key = new Uint8Array(32).fill(0x01);
      const nonce = new Uint8Array(12).fill(0x02);
      const original = new TextEncoder().encode('Secret message');
      const aad = new TextEncoder().encode('Associated data');

      const ciphertext = encrypt(key, nonce, original, aad);
      const decrypted = decrypt(key, nonce, ciphertext, aad);

      expect(decrypted).not.toBeNull();
      expect(bytesToHex(decrypted)).toBe(bytesToHex(original));
    });

    test('returns null for wrong key', () => {
      const correctKey = new Uint8Array(32).fill(0x01);
      const wrongKey = new Uint8Array(32).fill(0x02);
      const nonce = new Uint8Array(12).fill(0x00);
      const plaintext = new TextEncoder().encode('Test');

      const ciphertext = encrypt(correctKey, nonce, plaintext);
      const decrypted = decrypt(wrongKey, nonce, ciphertext);

      expect(decrypted).toBeNull();
    });

    test('returns null for wrong nonce', () => {
      const key = new Uint8Array(32).fill(0x01);
      const correctNonce = new Uint8Array(12).fill(0x01);
      const wrongNonce = new Uint8Array(12).fill(0x02);
      const plaintext = new TextEncoder().encode('Test');

      const ciphertext = encrypt(key, correctNonce, plaintext);
      const decrypted = decrypt(key, wrongNonce, ciphertext);

      expect(decrypted).toBeNull();
    });

    test('returns null for tampered ciphertext', () => {
      const key = new Uint8Array(32).fill(0x01);
      const nonce = new Uint8Array(12).fill(0x02);
      const plaintext = new TextEncoder().encode('Secret message');

      const ciphertext = encrypt(key, nonce, plaintext);
      // Tamper with the first byte
      ciphertext[0] ^= 0xFF;

      const decrypted = decrypt(key, nonce, ciphertext);
      expect(decrypted).toBeNull();
    });

    test('returns null for tampered tag', () => {
      const key = new Uint8Array(32).fill(0x01);
      const nonce = new Uint8Array(12).fill(0x02);
      const plaintext = new TextEncoder().encode('Secret message');

      const ciphertext = encrypt(key, nonce, plaintext);
      // Tamper with the last byte (part of tag)
      ciphertext[ciphertext.length - 1] ^= 0xFF;

      const decrypted = decrypt(key, nonce, ciphertext);
      expect(decrypted).toBeNull();
    });

    test('returns null for wrong AAD', () => {
      const key = new Uint8Array(32).fill(0x01);
      const nonce = new Uint8Array(12).fill(0x02);
      const plaintext = new TextEncoder().encode('Secret');
      const correctAad = new TextEncoder().encode('correct');
      const wrongAad = new TextEncoder().encode('wrong');

      const ciphertext = encrypt(key, nonce, plaintext, correctAad);
      const decrypted = decrypt(key, nonce, ciphertext, wrongAad);

      expect(decrypted).toBeNull();
    });

    test('throws for ciphertext shorter than tag', () => {
      const key = new Uint8Array(32);
      const nonce = new Uint8Array(12);
      const shortCiphertext = new Uint8Array(15); // Less than 16-byte tag

      expect(() => decrypt(key, nonce, shortCiphertext))
        .toThrow('Ciphertext must be at least 16 bytes');
    });

    test('throws for invalid key length', () => {
      const key = new Uint8Array(16);
      const nonce = new Uint8Array(12);
      const ciphertext = new Uint8Array(32);

      expect(() => decrypt(key, nonce, ciphertext)).toThrow('Key must be 32 bytes');
    });

    test('throws for invalid nonce length', () => {
      const key = new Uint8Array(32);
      const nonce = new Uint8Array(8);
      const ciphertext = new Uint8Array(32);

      expect(() => decrypt(key, nonce, ciphertext)).toThrow('Nonce must be 12 bytes');
    });
  });

  describe('encrypt/decrypt round-trip', () => {
    test('round-trip with various message sizes', () => {
      const key = new Uint8Array(32);
      for (let i = 0; i < 32; i++) key[i] = i;
      const nonce = new Uint8Array(12);
      for (let i = 0; i < 12; i++) nonce[i] = i + 100;

      const sizes = [0, 1, 15, 16, 17, 31, 32, 33, 63, 64, 65, 100, 500, 1000];

      for (const size of sizes) {
        const plaintext = new Uint8Array(size);
        for (let i = 0; i < size; i++) plaintext[i] = i & 0xFF;

        const ciphertext = encrypt(key, nonce, plaintext);
        const decrypted = decrypt(key, nonce, ciphertext);

        expect(decrypted).not.toBeNull();
        expect(bytesToHex(decrypted)).toBe(bytesToHex(plaintext));
      }
    });

    test('round-trip with random-like data', () => {
      const key = new Uint8Array(32);
      const nonce = new Uint8Array(12);
      const plaintext = new Uint8Array(256);

      // Fill with pseudo-random values
      for (let i = 0; i < 32; i++) key[i] = (i * 7 + 13) & 0xFF;
      for (let i = 0; i < 12; i++) nonce[i] = (i * 11 + 17) & 0xFF;
      for (let i = 0; i < 256; i++) plaintext[i] = (i * 23 + 31) & 0xFF;

      const ciphertext = encrypt(key, nonce, plaintext);
      const decrypted = decrypt(key, nonce, ciphertext);

      expect(decrypted).not.toBeNull();
      expect(bytesToHex(decrypted)).toBe(bytesToHex(plaintext));
    });

    test('round-trip with AAD of various sizes', () => {
      const key = new Uint8Array(32).fill(0x42);
      const nonce = new Uint8Array(12).fill(0x24);
      const plaintext = new TextEncoder().encode('Test message');

      const aadSizes = [0, 1, 16, 17, 100, 500];

      for (const aadSize of aadSizes) {
        const aad = new Uint8Array(aadSize);
        for (let i = 0; i < aadSize; i++) aad[i] = i & 0xFF;

        const ciphertext = encrypt(key, nonce, plaintext, aad);
        const decrypted = decrypt(key, nonce, ciphertext, aad);

        expect(decrypted).not.toBeNull();
        expect(bytesToHex(decrypted)).toBe(bytesToHex(plaintext));
      }
    });
  });

  describe('RFC 8439 test vectors', () => {
    // RFC 8439 Section 2.8.2 - AEAD Test Vector
    test('RFC 8439 Section 2.8.2 test vector', () => {
      const key = hexToBytes(
        '808182838485868788898a8b8c8d8e8f' +
        '909192939495969798999a9b9c9d9e9f'
      );

      const nonce = hexToBytes('070000004041424344454647');

      const aad = hexToBytes('50515253c0c1c2c3c4c5c6c7');

      const plaintext = new TextEncoder().encode(
        "Ladies and Gentlemen of the class of '99: " +
        "If I could offer you only one tip for the future, sunscreen would be it."
      );

      const expectedCiphertext = hexToBytes(
        'd31a8d34648e60db7b86afbc53ef7ec2' +
        'a4aded51296e08fea9e2b5a736ee62d6' +
        '3dbea45e8ca9671282fafb69da92728b' +
        '1a71de0a9e060b2905d6a5b67ecd3b36' +
        '92ddbd7f2d778b8c9803aee328091b58' +
        'fab324e4fad675945585808b4831d7bc' +
        '3ff4def08e4b7a9de576d26586cec64b' +
        '6116'
      );

      const expectedTag = hexToBytes('1ae10b594f09e26a7e902ecbd0600691');

      // Encrypt
      const ciphertext = encrypt(key, nonce, plaintext, aad);

      // The result should be ciphertext + tag
      const expectedFull = new Uint8Array(expectedCiphertext.length + expectedTag.length);
      expectedFull.set(expectedCiphertext, 0);
      expectedFull.set(expectedTag, expectedCiphertext.length);

      expect(bytesToHex(ciphertext)).toBe(bytesToHex(expectedFull));

      // Decrypt should return original plaintext
      const decrypted = decrypt(key, nonce, ciphertext, aad);
      expect(decrypted).not.toBeNull();
      expect(new TextDecoder().decode(decrypted)).toBe(
        "Ladies and Gentlemen of the class of '99: " +
        "If I could offer you only one tip for the future, sunscreen would be it."
      );
    });
  });

  describe('security properties', () => {
    test('ciphertext is different from plaintext', () => {
      const key = new Uint8Array(32).fill(0x01);
      const nonce = new Uint8Array(12).fill(0x02);
      const plaintext = new Uint8Array(32).fill(0xAA);

      const ciphertext = encrypt(key, nonce, plaintext);
      const ctWithoutTag = ciphertext.subarray(0, plaintext.length);

      expect(bytesToHex(ctWithoutTag)).not.toBe(bytesToHex(plaintext));
    });

    test('same message encrypted twice with same key/nonce produces same result', () => {
      const key = new Uint8Array(32).fill(0x01);
      const nonce = new Uint8Array(12).fill(0x02);
      const plaintext = new TextEncoder().encode('Deterministic encryption');

      const ct1 = encrypt(key, nonce, plaintext);
      const ct2 = encrypt(key, nonce, plaintext);

      expect(bytesToHex(ct1)).toBe(bytesToHex(ct2));
    });

    test('authentication tag changes with any bit flip in ciphertext', () => {
      const key = new Uint8Array(32).fill(0x01);
      const nonce = new Uint8Array(12).fill(0x02);
      const plaintext = new TextEncoder().encode('Test message for bit flip');

      const original = encrypt(key, nonce, plaintext);

      // Flip each bit in the ciphertext portion and verify decryption fails
      for (let byteIdx = 0; byteIdx < plaintext.length; byteIdx++) {
        for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
          const tampered = new Uint8Array(original);
          tampered[byteIdx] ^= (1 << bitIdx);

          const result = decrypt(key, nonce, tampered);
          expect(result).toBeNull();
        }
      }
    });
  });
});
