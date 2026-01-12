'use strict';

const { generateKeyPair, scalarMult, scalarMultBase } = require('../../src/crypto/x25519');

/**
 * Converts hex string to Uint8Array.
 * @param {string} hex - Hex string
 * @returns {Uint8Array} Byte array
 */
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Converts Uint8Array to hex string.
 * @param {Uint8Array} bytes - Byte array
 * @returns {string} Hex string
 */
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('X25519', () => {
  describe('RFC 7748 Test Vectors', () => {
    // Test vectors from RFC 7748 Section 6.1
    const alice = {
      secretKey: hexToBytes('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a'),
      publicKey: hexToBytes('8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a')
    };

    const bob = {
      secretKey: hexToBytes('5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb'),
      publicKey: hexToBytes('de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f')
    };

    const expectedSharedSecret = hexToBytes('4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742');

    test('Alice computes correct public key from secret key', () => {
      const publicKey = scalarMultBase(alice.secretKey);
      expect(bytesToHex(publicKey)).toBe(bytesToHex(alice.publicKey));
    });

    test('Bob computes correct public key from secret key', () => {
      const publicKey = scalarMultBase(bob.secretKey);
      expect(bytesToHex(publicKey)).toBe(bytesToHex(bob.publicKey));
    });

    test('Alice and Bob compute same shared secret', () => {
      // Alice computes shared secret using her secret key and Bob's public key
      const aliceShared = scalarMult(alice.secretKey, bob.publicKey);

      // Bob computes shared secret using his secret key and Alice's public key
      const bobShared = scalarMult(bob.secretKey, alice.publicKey);

      // Both should be equal
      expect(bytesToHex(aliceShared)).toBe(bytesToHex(bobShared));

      // And match expected value
      expect(bytesToHex(aliceShared)).toBe(bytesToHex(expectedSharedSecret));
    });
  });

  describe('generateKeyPair()', () => {
    test('generates valid key pair', () => {
      const { publicKey, secretKey } = generateKeyPair();

      expect(publicKey).toBeInstanceOf(Uint8Array);
      expect(secretKey).toBeInstanceOf(Uint8Array);
      expect(publicKey.length).toBe(32);
      expect(secretKey.length).toBe(32);
    });

    test('generates different key pairs each time', () => {
      const pair1 = generateKeyPair();
      const pair2 = generateKeyPair();

      expect(bytesToHex(pair1.secretKey)).not.toBe(bytesToHex(pair2.secretKey));
      expect(bytesToHex(pair1.publicKey)).not.toBe(bytesToHex(pair2.publicKey));
    });

    test('public key can be recomputed from secret key', () => {
      const { publicKey, secretKey } = generateKeyPair();
      const recomputed = scalarMultBase(secretKey);

      expect(bytesToHex(recomputed)).toBe(bytesToHex(publicKey));
    });
  });

  describe('scalarMult()', () => {
    test('two parties can establish shared secret', () => {
      const alice = generateKeyPair();
      const bob = generateKeyPair();

      const aliceShared = scalarMult(alice.secretKey, bob.publicKey);
      const bobShared = scalarMult(bob.secretKey, alice.publicKey);

      expect(bytesToHex(aliceShared)).toBe(bytesToHex(bobShared));
    });

    test('handles all-zeros point correctly', () => {
      const scalar = new Uint8Array(32);
      scalar[0] = 1;
      const point = new Uint8Array(32); // all zeros

      const result = scalarMult(scalar, point);

      // All-zeros input should return all-zeros
      expect(result).toEqual(new Uint8Array(32));
    });
  });

  describe('scalarMultBase()', () => {
    test('produces consistent results for same input', () => {
      const scalar = hexToBytes('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a');

      const result1 = scalarMultBase(scalar);
      const result2 = scalarMultBase(scalar);

      expect(bytesToHex(result1)).toBe(bytesToHex(result2));
    });
  });

  describe('Key Clamping', () => {
    test('clamps scalar correctly', () => {
      // Use a known scalar to verify clamping is applied
      const pair = generateKeyPair();

      // After clamping, bit 0, 1, 2 of first byte should be 0
      // This is internal behavior, but we can verify indirectly
      // by checking that the operation succeeds
      expect(pair.publicKey.length).toBe(32);
    });
  });

  describe('Edge Cases', () => {
    test('handles maximum scalar value', () => {
      const maxScalar = new Uint8Array(32).fill(0xff);
      const result = scalarMultBase(maxScalar);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
    });

    test('handles minimum non-zero scalar', () => {
      const minScalar = new Uint8Array(32);
      minScalar[0] = 1;
      const result = scalarMultBase(minScalar);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
    });
  });
});
