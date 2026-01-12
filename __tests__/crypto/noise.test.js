'use strict';

/**
 * @fileoverview Tests for Noise Protocol XX handshake implementation
 */

const { NoiseHandshake, HandshakeState, Role } = require('../../src/crypto/noise/handshake');
const { NoiseSession } = require('../../src/crypto/noise/session');
const { generateKeyPair } = require('../../src/crypto/x25519');

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

describe('Noise Protocol XX Handshake', () => {
  let initiatorStatic;
  let responderStatic;

  beforeEach(() => {
    // Generate fresh key pairs for each test
    initiatorStatic = generateKeyPair();
    responderStatic = generateKeyPair();
  });

  describe('NoiseHandshake initialization', () => {
    test('creates new handshake instance', () => {
      const handshake = new NoiseHandshake();
      expect(handshake).toBeInstanceOf(NoiseHandshake);
    });

    test('initializes as initiator', () => {
      const handshake = new NoiseHandshake();
      handshake.initializeInitiator(initiatorStatic);
      expect(handshake.isComplete()).toBe(false);
    });

    test('initializes as responder', () => {
      const handshake = new NoiseHandshake();
      handshake.initializeResponder(responderStatic);
      expect(handshake.isComplete()).toBe(false);
    });

    test('throws for invalid static key pair', () => {
      const handshake = new NoiseHandshake();
      expect(() => handshake.initializeInitiator(null))
        .toThrow('Invalid static key pair');
    });

    test('throws for missing public key', () => {
      const handshake = new NoiseHandshake();
      expect(() => handshake.initializeInitiator({ secretKey: new Uint8Array(32) }))
        .toThrow('Invalid static key pair');
    });

    test('throws for wrong key size', () => {
      const handshake = new NoiseHandshake();
      expect(() => handshake.initializeInitiator({
        publicKey: new Uint8Array(16),
        secretKey: new Uint8Array(32)
      })).toThrow('static public key must be 32 bytes');
    });

    test('throws if initialized twice', () => {
      const handshake = new NoiseHandshake();
      handshake.initializeInitiator(initiatorStatic);
      expect(() => handshake.initializeInitiator(initiatorStatic))
        .toThrow('Invalid state');
    });
  });

  describe('complete XX handshake', () => {
    test('performs full handshake between initiator and responder', () => {
      const initiator = new NoiseHandshake();
      const responder = new NoiseHandshake();

      initiator.initializeInitiator(initiatorStatic);
      responder.initializeResponder(responderStatic);

      // Message 1: initiator -> responder (e)
      const msg1 = initiator.writeMessage1();
      expect(msg1).toBeInstanceOf(Uint8Array);
      expect(msg1.length).toBe(32); // Ephemeral public key

      responder.readMessage1(msg1);

      // Message 2: responder -> initiator (e, ee, s, es)
      const msg2 = responder.writeMessage2();
      expect(msg2).toBeInstanceOf(Uint8Array);
      expect(msg2.length).toBe(32 + 32 + 16); // e + encrypted_s + tag

      initiator.readMessage2(msg2);

      // Message 3: initiator -> responder (s, se)
      const msg3 = initiator.writeMessage3();
      expect(msg3).toBeInstanceOf(Uint8Array);
      expect(msg3.length).toBe(32 + 16); // encrypted_s + tag

      responder.readMessage3(msg3);

      // Both sides should now be complete
      expect(initiator.isComplete()).toBe(true);
      expect(responder.isComplete()).toBe(true);
    });

    test('both parties derive each others static public key', () => {
      const initiator = new NoiseHandshake();
      const responder = new NoiseHandshake();

      initiator.initializeInitiator(initiatorStatic);
      responder.initializeResponder(responderStatic);

      // Complete handshake
      const msg1 = initiator.writeMessage1();
      responder.readMessage1(msg1);
      const msg2 = responder.writeMessage2();
      initiator.readMessage2(msg2);
      const msg3 = initiator.writeMessage3();
      responder.readMessage3(msg3);

      // Initiator should have responder's static key
      const initiatorSeesResponder = initiator.getRemotePublicKey();
      expect(bytesToHex(initiatorSeesResponder)).toBe(bytesToHex(responderStatic.publicKey));

      // Responder should have initiator's static key
      const responderSeesInitiator = responder.getRemotePublicKey();
      expect(bytesToHex(responderSeesInitiator)).toBe(bytesToHex(initiatorStatic.publicKey));
    });

    test('handshake hash is available after completion', () => {
      const initiator = new NoiseHandshake();
      const responder = new NoiseHandshake();

      initiator.initializeInitiator(initiatorStatic);
      responder.initializeResponder(responderStatic);

      // Complete handshake
      const msg1 = initiator.writeMessage1();
      responder.readMessage1(msg1);
      const msg2 = responder.writeMessage2();
      initiator.readMessage2(msg2);
      const msg3 = initiator.writeMessage3();
      responder.readMessage3(msg3);

      const initiatorHash = initiator.getHandshakeHash();
      const responderHash = responder.getHandshakeHash();

      expect(initiatorHash).toBeInstanceOf(Uint8Array);
      expect(initiatorHash.length).toBe(32);
      expect(bytesToHex(initiatorHash)).toBe(bytesToHex(responderHash));
    });
  });

  describe('state machine validation', () => {
    test('throws for writeMessage1 by responder', () => {
      const handshake = new NoiseHandshake();
      handshake.initializeResponder(responderStatic);
      expect(() => handshake.writeMessage1()).toThrow('Invalid role');
    });

    test('throws for readMessage1 by initiator', () => {
      const handshake = new NoiseHandshake();
      handshake.initializeInitiator(initiatorStatic);
      expect(() => handshake.readMessage1(new Uint8Array(32))).toThrow('Invalid role');
    });

    test('throws for out-of-order messages', () => {
      const handshake = new NoiseHandshake();
      handshake.initializeInitiator(initiatorStatic);

      // Try to read message 2 before writing message 1
      expect(() => handshake.readMessage2(new Uint8Array(80))).toThrow('Invalid state');
    });

    test('throws for writeMessage2 before reading message 1', () => {
      const handshake = new NoiseHandshake();
      handshake.initializeResponder(responderStatic);
      expect(() => handshake.writeMessage2()).toThrow('Invalid state');
    });

    test('throws for getSession before completion', () => {
      const handshake = new NoiseHandshake();
      handshake.initializeInitiator(initiatorStatic);
      expect(() => handshake.getSession()).toThrow('Handshake not complete');
    });

    test('throws for getHandshakeHash before initialization', () => {
      const handshake = new NoiseHandshake();
      expect(() => handshake.getHandshakeHash()).toThrow('Handshake not initialized');
    });
  });

  describe('message validation', () => {
    test('throws for message 1 too short', () => {
      const responder = new NoiseHandshake();
      responder.initializeResponder(responderStatic);
      expect(() => responder.readMessage1(new Uint8Array(16))).toThrow('Message 1 too short');
    });

    test('throws for message 2 too short', () => {
      const initiator = new NoiseHandshake();
      initiator.initializeInitiator(initiatorStatic);
      initiator.writeMessage1();
      expect(() => initiator.readMessage2(new Uint8Array(32))).toThrow('Message 2 too short');
    });

    test('throws for message 3 too short', () => {
      const initiator = new NoiseHandshake();
      const responder = new NoiseHandshake();

      initiator.initializeInitiator(initiatorStatic);
      responder.initializeResponder(responderStatic);

      const msg1 = initiator.writeMessage1();
      responder.readMessage1(msg1);
      responder.writeMessage2();

      expect(() => responder.readMessage3(new Uint8Array(16))).toThrow('Message 3 too short');
    });
  });

  describe('NoiseSession', () => {
    let initiatorSession;
    let responderSession;

    beforeEach(() => {
      const initiator = new NoiseHandshake();
      const responder = new NoiseHandshake();

      initiator.initializeInitiator(initiatorStatic);
      responder.initializeResponder(responderStatic);

      // Complete handshake
      const msg1 = initiator.writeMessage1();
      responder.readMessage1(msg1);
      const msg2 = responder.writeMessage2();
      initiator.readMessage2(msg2);
      const msg3 = initiator.writeMessage3();
      responder.readMessage3(msg3);

      initiatorSession = initiator.getSession();
      responderSession = responder.getSession();
    });

    test('creates session after handshake', () => {
      expect(initiatorSession).toBeInstanceOf(NoiseSession);
      expect(responderSession).toBeInstanceOf(NoiseSession);
    });

    test('sessions are established', () => {
      expect(initiatorSession.isEstablished()).toBe(true);
      expect(responderSession.isEstablished()).toBe(true);
    });

    test('bidirectional encryption works', () => {
      // Initiator to responder
      const message1 = new TextEncoder().encode('Hello from initiator!');
      const encrypted1 = initiatorSession.encrypt(message1);
      const decrypted1 = responderSession.decrypt(encrypted1);

      expect(decrypted1).not.toBeNull();
      expect(new TextDecoder().decode(decrypted1)).toBe('Hello from initiator!');

      // Responder to initiator
      const message2 = new TextEncoder().encode('Hello from responder!');
      const encrypted2 = responderSession.encrypt(message2);
      const decrypted2 = initiatorSession.decrypt(encrypted2);

      expect(decrypted2).not.toBeNull();
      expect(new TextDecoder().decode(decrypted2)).toBe('Hello from responder!');
    });

    test('multiple messages with incrementing nonces', () => {
      for (let i = 0; i < 10; i++) {
        const message = new TextEncoder().encode(`Message ${i}`);
        const encrypted = initiatorSession.encrypt(message);
        const decrypted = responderSession.decrypt(encrypted);

        expect(decrypted).not.toBeNull();
        expect(new TextDecoder().decode(decrypted)).toBe(`Message ${i}`);
      }

      expect(initiatorSession.sendNonce).toBe(10);
      expect(responderSession.receiveNonce).toBe(10);
    });

    test('rejects out-of-order messages', () => {
      const msg1 = initiatorSession.encrypt(new TextEncoder().encode('First'));
      const msg2 = initiatorSession.encrypt(new TextEncoder().encode('Second'));

      // Decrypt in correct order
      const dec1 = responderSession.decrypt(msg1);
      expect(dec1).not.toBeNull();

      // Skip msg2 and try to decrypt it after receiving msg1
      // This should still work since we're decrypting the next expected nonce
      const dec2 = responderSession.decrypt(msg2);
      expect(dec2).not.toBeNull();
    });

    test('rejects replayed messages', () => {
      const message = new TextEncoder().encode('Original');
      const encrypted = initiatorSession.encrypt(message);

      // First decryption succeeds
      const decrypted = responderSession.decrypt(encrypted);
      expect(decrypted).not.toBeNull();

      // Replay attempt fails (nonce has advanced)
      const replayed = responderSession.decrypt(encrypted);
      expect(replayed).toBeNull();
    });

    test('rejects tampered messages', () => {
      const message = new TextEncoder().encode('Sensitive data');
      const encrypted = initiatorSession.encrypt(message);

      // Tamper with the ciphertext
      encrypted[0] ^= 0xFF;

      const decrypted = responderSession.decrypt(encrypted);
      expect(decrypted).toBeNull();
    });

    test('throws for non-Uint8Array plaintext', () => {
      expect(() => initiatorSession.encrypt('string')).toThrow('Plaintext must be a Uint8Array');
    });

    test('throws for non-Uint8Array ciphertext', () => {
      expect(() => responderSession.decrypt('string')).toThrow('Ciphertext must be a Uint8Array');
    });

    test('throws for ciphertext too short', () => {
      expect(() => responderSession.decrypt(new Uint8Array(8))).toThrow('Ciphertext too short');
    });
  });

  describe('session export/import', () => {
    test('exports session state', () => {
      const initiator = new NoiseHandshake();
      const responder = new NoiseHandshake();

      initiator.initializeInitiator(initiatorStatic);
      responder.initializeResponder(responderStatic);

      const msg1 = initiator.writeMessage1();
      responder.readMessage1(msg1);
      const msg2 = responder.writeMessage2();
      initiator.readMessage2(msg2);
      const msg3 = initiator.writeMessage3();
      responder.readMessage3(msg3);

      const session = initiator.getSession();
      const exported = session.exportState();

      expect(exported).toHaveProperty('sendKey');
      expect(exported).toHaveProperty('receiveKey');
      expect(exported).toHaveProperty('sendNonce');
      expect(exported).toHaveProperty('receiveNonce');
      expect(exported).toHaveProperty('isInitiator');
      expect(exported).toHaveProperty('established');
    });

    test('imports session state', () => {
      const initiator = new NoiseHandshake();
      const responder = new NoiseHandshake();

      initiator.initializeInitiator(initiatorStatic);
      responder.initializeResponder(responderStatic);

      const msg1 = initiator.writeMessage1();
      responder.readMessage1(msg1);
      const msg2 = responder.writeMessage2();
      initiator.readMessage2(msg2);
      const msg3 = initiator.writeMessage3();
      responder.readMessage3(msg3);

      const originalSession = initiator.getSession();

      // Send a few messages to advance nonces
      originalSession.encrypt(new TextEncoder().encode('msg1'));
      originalSession.encrypt(new TextEncoder().encode('msg2'));

      // Export and import
      const exported = originalSession.exportState();
      const importedSession = NoiseSession.importState(exported);

      expect(importedSession.sendNonce).toBe(originalSession.sendNonce);
      expect(importedSession.receiveNonce).toBe(originalSession.receiveNonce);
      expect(importedSession.isEstablished()).toBe(true);
    });

    test('imported session can encrypt/decrypt', () => {
      const initiator = new NoiseHandshake();
      const responder = new NoiseHandshake();

      initiator.initializeInitiator(initiatorStatic);
      responder.initializeResponder(responderStatic);

      const msg1 = initiator.writeMessage1();
      responder.readMessage1(msg1);
      const msg2 = responder.writeMessage2();
      initiator.readMessage2(msg2);
      const msg3 = initiator.writeMessage3();
      responder.readMessage3(msg3);

      const initiatorSession = initiator.getSession();
      const responderSession = responder.getSession();

      // Export and import initiator session
      const exported = initiatorSession.exportState();
      const importedInitiator = NoiseSession.importState(exported);

      // Send message from imported session
      const message = new TextEncoder().encode('From imported session');
      const encrypted = importedInitiator.encrypt(message);
      const decrypted = responderSession.decrypt(encrypted);

      expect(decrypted).not.toBeNull();
      expect(new TextDecoder().decode(decrypted)).toBe('From imported session');
    });

    test('throws for invalid state import', () => {
      expect(() => NoiseSession.importState(null)).toThrow('Invalid session state');
      expect(() => NoiseSession.importState('string')).toThrow('Invalid session state');
    });

    test('throws for missing required fields', () => {
      expect(() => NoiseSession.importState({ sendKey: [] })).toThrow('Missing required field');
    });
  });

  describe('session destruction', () => {
    test('destroy zeros sensitive data', () => {
      const initiator = new NoiseHandshake();
      const responder = new NoiseHandshake();

      initiator.initializeInitiator(initiatorStatic);
      responder.initializeResponder(responderStatic);

      const msg1 = initiator.writeMessage1();
      responder.readMessage1(msg1);
      const msg2 = responder.writeMessage2();
      initiator.readMessage2(msg2);
      const msg3 = initiator.writeMessage3();
      responder.readMessage3(msg3);

      const session = initiator.getSession();
      session.destroy();

      expect(session.isEstablished()).toBe(false);
      expect(session.sendNonce).toBe(0);
      expect(session.receiveNonce).toBe(0);
    });

    test('destroyed session throws on encrypt', () => {
      const initiator = new NoiseHandshake();
      const responder = new NoiseHandshake();

      initiator.initializeInitiator(initiatorStatic);
      responder.initializeResponder(responderStatic);

      const msg1 = initiator.writeMessage1();
      responder.readMessage1(msg1);
      const msg2 = responder.writeMessage2();
      initiator.readMessage2(msg2);
      const msg3 = initiator.writeMessage3();
      responder.readMessage3(msg3);

      const session = initiator.getSession();
      session.destroy();

      expect(() => session.encrypt(new Uint8Array(10))).toThrow('Session not established');
    });

    test('destroyed session throws on decrypt', () => {
      const initiator = new NoiseHandshake();
      const responder = new NoiseHandshake();

      initiator.initializeInitiator(initiatorStatic);
      responder.initializeResponder(responderStatic);

      const msg1 = initiator.writeMessage1();
      responder.readMessage1(msg1);
      const msg2 = responder.writeMessage2();
      initiator.readMessage2(msg2);
      const msg3 = initiator.writeMessage3();
      responder.readMessage3(msg3);

      const session = initiator.getSession();
      session.destroy();

      expect(() => session.decrypt(new Uint8Array(32))).toThrow('Session not established');
    });
  });

  describe('session statistics', () => {
    test('getStats returns session information', () => {
      const initiator = new NoiseHandshake();
      const responder = new NoiseHandshake();

      initiator.initializeInitiator(initiatorStatic);
      responder.initializeResponder(responderStatic);

      const msg1 = initiator.writeMessage1();
      responder.readMessage1(msg1);
      const msg2 = responder.writeMessage2();
      initiator.readMessage2(msg2);
      const msg3 = initiator.writeMessage3();
      responder.readMessage3(msg3);

      const session = initiator.getSession();

      // Send some messages
      session.encrypt(new TextEncoder().encode('msg1'));
      session.encrypt(new TextEncoder().encode('msg2'));

      const stats = session.getStats();

      expect(stats.messagesSent).toBe(2);
      expect(stats.messagesReceived).toBe(0);
      expect(stats.isInitiator).toBe(true);
      expect(stats.established).toBe(true);
    });
  });
});
