/**
 * Jest setup file
 * Runs before each test file
 */

// Increase timeout for crypto operations
jest.setTimeout(10000);

// Global test utilities
global.testUtils = {
  /**
   * Create a Uint8Array from hex string
   * @param {string} hex - Hex string
   * @returns {Uint8Array}
   */
  hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  },

  /**
   * Convert Uint8Array to hex string
   * @param {Uint8Array} bytes
   * @returns {string}
   */
  bytesToHex(bytes) {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },

  /**
   * Create a random Uint8Array
   * @param {number} length
   * @returns {Uint8Array}
   */
  randomBytes(length) {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  },

  /**
   * Compare two Uint8Arrays for equality
   * @param {Uint8Array} a
   * @param {Uint8Array} b
   * @returns {boolean}
   */
  bytesEqual(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }
};

// Custom matchers
expect.extend({
  /**
   * Check if two Uint8Arrays are equal
   */
  toEqualBytes(received, expected) {
    const pass = global.testUtils.bytesEqual(received, expected);
    if (pass) {
      return {
        message: () =>
          `expected ${global.testUtils.bytesToHex(received)} not to equal ` +
          `${global.testUtils.bytesToHex(expected)}`,
        pass: true
      };
    } else {
      return {
        message: () =>
          `expected ${global.testUtils.bytesToHex(received)} to equal ` +
          `${global.testUtils.bytesToHex(expected)}`,
        pass: false
      };
    }
  }
});
