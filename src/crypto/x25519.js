'use strict';

/**
 * @fileoverview X25519 Elliptic Curve Diffie-Hellman (RFC 7748)
 * Pure JavaScript implementation using BigInt for field arithmetic.
 * @module crypto/x25519
 */

const { randomBytes } = require('../utils/bytes');

/** Prime field modulus: p = 2^255 - 19 */
const P = (1n << 255n) - 19n;
/** a24 = (A - 2) / 4 = 121665 where A = 486662 for Curve25519 */
const A24 = 121665n;
/** Base point u-coordinate */
const BASE_POINT = 9n;

/** Converts Uint8Array to BigInt (little-endian). */
function bytesToBigInt(bytes) {
  let result = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(bytes[i]);
  }
  return result;
}

/** Converts BigInt to Uint8Array (little-endian, 32 bytes). */
function bigIntToBytes(n) {
  const bytes = new Uint8Array(32);
  let value = n;
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return bytes;
}

/** Field operations: add, sub, mul, square */
const fieldAdd = (a, b) => (a + b) % P;
const fieldSub = (a, b) => ((a - b) % P + P) % P;
const fieldMul = (a, b) => (a * b) % P;
const fieldSquare = (a) => (a * a) % P;

/** Modular exponentiation using square-and-multiply. */
function fieldPow(base, exp) {
  let result = 1n;
  base = base % P;
  while (exp > 0n) {
    if (exp & 1n) { result = fieldMul(result, base); }
    exp >>= 1n;
    base = fieldSquare(base);
  }
  return result;
}

/** Modular inverse using Fermat's little theorem: a^(-1) = a^(p-2) mod p. */
const fieldInvert = (a) => fieldPow(a, P - 2n);

/**
 * Conditional swap - swaps a and b if swap is 1, otherwise leaves unchanged.
 * Implemented without branching on secret data.
 */
function cswap(swap, a, b) {
  const mask = -swap;
  const diff = (a ^ b) & mask;
  return [a ^ diff, b ^ diff];
}

/**
 * Clamps a scalar per RFC 7748 Section 5.
 * @param {Uint8Array} k - 32-byte scalar
 * @returns {Uint8Array} Clamped scalar
 */
function clampScalar(k) {
  const clamped = new Uint8Array(k);
  clamped[0] &= 248; // Clear bits 0, 1, 2
  clamped[31] &= 127; // Clear bit 7 of last byte
  clamped[31] |= 64; // Set bit 6 of last byte
  return clamped;
}

/**
 * Montgomery ladder for X25519 scalar multiplication.
 * Computes scalar * point on Curve25519.
 * @param {Uint8Array} scalar - 32-byte scalar (will be clamped)
 * @param {Uint8Array} point - 32-byte u-coordinate
 * @returns {Uint8Array} 32-byte result u-coordinate
 */
function scalarMult(scalar, point) {
  const k = bytesToBigInt(clampScalar(scalar));
  let u = bytesToBigInt(point);

  // Handle edge case: all-zeros point returns all-zeros
  if (u === 0n) { return new Uint8Array(32); }
  u = u % P;

  // Montgomery ladder state (RFC 7748 naming convention)
  // eslint-disable-next-line camelcase, prefer-const
  let x_1 = u, x_2 = 1n, z_2 = 0n, x_3 = u, z_3 = 1n, swap = 0n;

  // Process bits from 254 down to 0
  for (let t = 254; t >= 0; t--) {
    // eslint-disable-next-line camelcase
    const k_t = (k >> BigInt(t)) & 1n;
    swap ^= k_t; // eslint-disable-line camelcase
    [x_2, x_3] = cswap(swap, x_2, x_3); // eslint-disable-line camelcase
    [z_2, z_3] = cswap(swap, z_2, z_3); // eslint-disable-line camelcase
    swap = k_t; // eslint-disable-line camelcase

    const A = fieldAdd(x_2, z_2); // eslint-disable-line camelcase
    const AA = fieldSquare(A);
    const B = fieldSub(x_2, z_2); // eslint-disable-line camelcase
    const BB = fieldSquare(B);
    const E = fieldSub(AA, BB);
    const C = fieldAdd(x_3, z_3); // eslint-disable-line camelcase
    const D = fieldSub(x_3, z_3); // eslint-disable-line camelcase
    const DA = fieldMul(D, A);
    const CB = fieldMul(C, B);
    x_3 = fieldSquare(fieldAdd(DA, CB)); // eslint-disable-line camelcase
    z_3 = fieldMul(x_1, fieldSquare(fieldSub(DA, CB))); // eslint-disable-line camelcase
    x_2 = fieldMul(AA, BB); // eslint-disable-line camelcase
    z_2 = fieldMul(E, fieldAdd(AA, fieldMul(A24, E))); // eslint-disable-line camelcase
  }

  [x_2, x_3] = cswap(swap, x_2, x_3); // eslint-disable-line camelcase
  [z_2, z_3] = cswap(swap, z_2, z_3); // eslint-disable-line camelcase

  return bigIntToBytes(fieldMul(x_2, fieldInvert(z_2))); // eslint-disable-line camelcase
}

/**
 * Computes scalar multiplication with the base point (u = 9).
 * @param {Uint8Array} scalar - 32-byte scalar (will be clamped)
 * @returns {Uint8Array} 32-byte public key
 */
function scalarMultBase(scalar) {
  return scalarMult(scalar, bigIntToBytes(BASE_POINT));
}

/**
 * Generates a new X25519 key pair.
 * @returns {{publicKey: Uint8Array, secretKey: Uint8Array}} Key pair
 */
function generateKeyPair() {
  const secretKey = randomBytes(32);
  const publicKey = scalarMultBase(secretKey);
  return { publicKey, secretKey };
}

module.exports = {
  generateKeyPair,
  scalarMult,
  scalarMultBase
};
