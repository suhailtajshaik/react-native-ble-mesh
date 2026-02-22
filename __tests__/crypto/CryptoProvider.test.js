'use strict';

const CryptoProvider = require('../../src/crypto/CryptoProvider');
const TweetNaClProvider = require('../../src/crypto/providers/TweetNaClProvider');
const { createProvider } = require('../../src/crypto/AutoCrypto');

describe('CryptoProvider (abstract)', () => {
  it('throws on all abstract methods', () => {
    const p = new CryptoProvider();
    expect(p.name).toBe('abstract');
    expect(() => p.generateKeyPair()).toThrow('must be implemented');
    expect(() => p.sharedSecret(null, null)).toThrow('must be implemented');
    expect(() => p.encrypt(null, null, null)).toThrow('must be implemented');
    expect(() => p.decrypt(null, null, null)).toThrow('must be implemented');
    expect(() => p.hash(null)).toThrow('must be implemented');
    expect(() => p.randomBytes(16)).toThrow('must be implemented');
  });

  it('isAvailable returns false', () => {
    expect(CryptoProvider.isAvailable()).toBe(false);
  });
});

describe('TweetNaClProvider', () => {
  // Create a mock nacl for testing without actual tweetnacl dependency
  const mockNacl = {
    box: {
      keyPair: () => ({
        publicKey: new Uint8Array(32).fill(1),
        secretKey: new Uint8Array(32).fill(2),
      }),
      before: (pk, sk) => new Uint8Array(32).fill(3),
    },
    secretbox: (msg, nonce, key) => {
      // Simple mock: prepend 16 bytes of "tag" 
      const result = new Uint8Array(msg.length + 16);
      result.set(new Uint8Array(16).fill(0xAA), 0);
      result.set(msg, 16);
      return result;
    },
    hash: (data) => new Uint8Array(64).fill(4),
    randomBytes: (n) => new Uint8Array(n).fill(5),
  };
  // Add open method
  mockNacl.secretbox.open = (ct, nonce, key) => {
    if (ct.length < 16) return null;
    return ct.slice(16);
  };

  let provider;

  beforeEach(() => {
    provider = new TweetNaClProvider({ nacl: mockNacl });
  });

  it('has correct name', () => {
    expect(provider.name).toBe('tweetnacl');
  });

  it('generates key pair', () => {
    const kp = provider.generateKeyPair();
    expect(kp.publicKey).toBeInstanceOf(Uint8Array);
    expect(kp.secretKey).toBeInstanceOf(Uint8Array);
    expect(kp.publicKey.length).toBe(32);
    expect(kp.secretKey.length).toBe(32);
  });

  it('computes shared secret', () => {
    const secret = provider.sharedSecret(new Uint8Array(32), new Uint8Array(32));
    expect(secret).toBeInstanceOf(Uint8Array);
    expect(secret.length).toBe(32);
  });

  it('encrypts and decrypts', () => {
    const key = new Uint8Array(32).fill(1);
    const nonce = new Uint8Array(24).fill(2);
    const plaintext = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

    const ciphertext = provider.encrypt(key, nonce, plaintext);
    expect(ciphertext).toBeInstanceOf(Uint8Array);
    expect(ciphertext.length).toBeGreaterThan(plaintext.length);

    const decrypted = provider.decrypt(key, nonce, ciphertext);
    expect(decrypted).toEqual(plaintext);
  });

  it('returns null on decrypt failure', () => {
    const key = new Uint8Array(32);
    const nonce = new Uint8Array(24);
    const result = provider.decrypt(key, nonce, new Uint8Array(5));
    expect(result).toBeNull();
  });

  it('hashes data', () => {
    const hash = provider.hash(new Uint8Array([1, 2, 3]));
    expect(hash).toBeInstanceOf(Uint8Array);
    expect(hash.length).toBe(32);
  });

  it('generates random bytes', () => {
    const bytes = provider.randomBytes(16);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(16);
  });
});

describe('createProvider()', () => {
  it('accepts a provider instance', () => {
    const mockProvider = {
      generateKeyPair: jest.fn(),
      name: 'mock',
    };
    const result = createProvider(mockProvider);
    expect(result).toBe(mockProvider);
  });

  it('throws on unknown provider name', () => {
    expect(() => createProvider('unknown-provider')).toThrow('Unknown crypto provider');
  });

  it('throws on invalid config type', () => {
    expect(() => createProvider(42)).toThrow('Invalid crypto config');
  });
});
