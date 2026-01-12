'use strict';

/**
 * @fileoverview Integration tests for complete handshake flow using MockTransport
 */

const { NoiseHandshake } = require('../../src/crypto/noise/handshake');
const { generateKeyPair } = require('../../src/crypto/x25519');
const MockTransport = require('../../src/transport/MockTransport');
const { MESSAGE_TYPE } = require('../../src/constants');

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

/**
 * Creates a message frame with type prefix
 * @param {number} type - Message type
 * @param {Uint8Array} payload - Payload data
 * @returns {Uint8Array}
 */
function createFrame(type, payload) {
  const frame = new Uint8Array(1 + payload.length);
  frame[0] = type;
  frame.set(payload, 1);
  return frame;
}

/**
 * Extracts payload from a message frame
 * @param {Uint8Array} frame - Frame data
 * @returns {{type: number, payload: Uint8Array}}
 */
function parseFrame(frame) {
  return {
    type: frame[0],
    payload: frame.subarray(1)
  };
}

describe('Handshake Integration', () => {
  let aliceTransport;
  let bobTransport;
  let aliceStatic;
  let bobStatic;

  beforeEach(async () => {
    // Generate static key pairs
    aliceStatic = generateKeyPair();
    bobStatic = generateKeyPair();

    // Create and link transports
    aliceTransport = new MockTransport({ localPeerId: 'alice', latencyMs: 1 });
    bobTransport = new MockTransport({ localPeerId: 'bob', latencyMs: 1 });

    aliceTransport.linkTo(bobTransport);

    // Start transports
    await aliceTransport.start();
    await bobTransport.start();

    // Simulate peer connections
    aliceTransport.simulatePeerConnect('bob');
    bobTransport.simulatePeerConnect('alice');
  });

  afterEach(async () => {
    await aliceTransport.stop();
    await bobTransport.stop();
  });

  describe('complete handshake flow', () => {
    test('performs full XX handshake over MockTransport', async () => {
      const aliceHandshake = new NoiseHandshake();
      const bobHandshake = new NoiseHandshake();

      aliceHandshake.initializeInitiator(aliceStatic);
      bobHandshake.initializeResponder(bobStatic);

      // Setup message collectors BEFORE sending
      const bobMessages = [];
      const aliceMessages = [];
      bobTransport.on('message', ({ data }) => bobMessages.push(data));
      aliceTransport.on('message', ({ data }) => aliceMessages.push(data));

      // Message 1: Alice -> Bob
      const msg1 = aliceHandshake.writeMessage1();
      const frame1 = createFrame(MESSAGE_TYPE.HANDSHAKE_INIT, msg1);
      await aliceTransport.send('bob', frame1);
      await new Promise(r => setTimeout(r, 50));

      expect(bobMessages.length).toBe(1);
      const parsed1 = parseFrame(bobMessages[0]);
      expect(parsed1.type).toBe(MESSAGE_TYPE.HANDSHAKE_INIT);
      bobHandshake.readMessage1(parsed1.payload);

      // Message 2: Bob -> Alice
      const msg2 = bobHandshake.writeMessage2();
      const frame2 = createFrame(MESSAGE_TYPE.HANDSHAKE_RESPONSE, msg2);
      await bobTransport.send('alice', frame2);
      await new Promise(r => setTimeout(r, 50));

      expect(aliceMessages.length).toBe(1);
      const parsed2 = parseFrame(aliceMessages[0]);
      expect(parsed2.type).toBe(MESSAGE_TYPE.HANDSHAKE_RESPONSE);
      aliceHandshake.readMessage2(parsed2.payload);

      // Message 3: Alice -> Bob
      const msg3 = aliceHandshake.writeMessage3();
      const frame3 = createFrame(MESSAGE_TYPE.HANDSHAKE_FINAL, msg3);
      await aliceTransport.send('bob', frame3);
      await new Promise(r => setTimeout(r, 50));

      expect(bobMessages.length).toBe(2);
      const parsed3 = parseFrame(bobMessages[1]);
      expect(parsed3.type).toBe(MESSAGE_TYPE.HANDSHAKE_FINAL);
      bobHandshake.readMessage3(parsed3.payload);

      // Both should be complete
      expect(aliceHandshake.isComplete()).toBe(true);
      expect(bobHandshake.isComplete()).toBe(true);

      // Verify key exchange
      expect(bytesToHex(aliceHandshake.getRemotePublicKey()))
        .toBe(bytesToHex(bobStatic.publicKey));
      expect(bytesToHex(bobHandshake.getRemotePublicKey()))
        .toBe(bytesToHex(aliceStatic.publicKey));
    });

    test('establishes encrypted communication after handshake', async () => {
      const aliceHandshake = new NoiseHandshake();
      const bobHandshake = new NoiseHandshake();

      aliceHandshake.initializeInitiator(aliceStatic);
      bobHandshake.initializeResponder(bobStatic);

      // Complete handshake
      const msg1 = aliceHandshake.writeMessage1();
      bobHandshake.readMessage1(msg1);

      const msg2 = bobHandshake.writeMessage2();
      aliceHandshake.readMessage2(msg2);

      const msg3 = aliceHandshake.writeMessage3();
      bobHandshake.readMessage3(msg3);

      // Get sessions
      const aliceSession = aliceHandshake.getSession();
      const bobSession = bobHandshake.getSession();

      // Alice sends encrypted message to Bob
      const plaintext1 = new TextEncoder().encode('Hello Bob!');
      const ciphertext1 = aliceSession.encrypt(plaintext1);

      await aliceTransport.send('bob', ciphertext1);
      await new Promise(r => setTimeout(r, 50));

      const bobReceived = bobTransport.getMessageLog()
        .filter(m => m.type === 'receive')
        .map(m => m.data);

      expect(bobReceived.length).toBeGreaterThan(0);
      const decrypted1 = bobSession.decrypt(bobReceived[bobReceived.length - 1]);

      expect(decrypted1).not.toBeNull();
      expect(new TextDecoder().decode(decrypted1)).toBe('Hello Bob!');

      // Bob sends encrypted message to Alice
      const plaintext2 = new TextEncoder().encode('Hello Alice!');
      const ciphertext2 = bobSession.encrypt(plaintext2);

      await bobTransport.send('alice', ciphertext2);
      await new Promise(r => setTimeout(r, 50));

      const aliceReceived = aliceTransport.getMessageLog()
        .filter(m => m.type === 'receive')
        .map(m => m.data);

      expect(aliceReceived.length).toBeGreaterThan(0);
      const decrypted2 = aliceSession.decrypt(aliceReceived[aliceReceived.length - 1]);

      expect(decrypted2).not.toBeNull();
      expect(new TextDecoder().decode(decrypted2)).toBe('Hello Alice!');
    });

    test('multiple message exchange after handshake', async () => {
      const aliceHandshake = new NoiseHandshake();
      const bobHandshake = new NoiseHandshake();

      aliceHandshake.initializeInitiator(aliceStatic);
      bobHandshake.initializeResponder(bobStatic);

      // Complete handshake
      bobHandshake.readMessage1(aliceHandshake.writeMessage1());
      aliceHandshake.readMessage2(bobHandshake.writeMessage2());
      bobHandshake.readMessage3(aliceHandshake.writeMessage3());

      const aliceSession = aliceHandshake.getSession();
      const bobSession = bobHandshake.getSession();

      // Exchange multiple messages
      const messages = [
        { from: 'alice', text: 'Message 1' },
        { from: 'bob', text: 'Message 2' },
        { from: 'alice', text: 'Message 3' },
        { from: 'bob', text: 'Message 4' },
        { from: 'alice', text: 'Message 5' }
      ];

      for (const msg of messages) {
        const plaintext = new TextEncoder().encode(msg.text);

        if (msg.from === 'alice') {
          const encrypted = aliceSession.encrypt(plaintext);
          const decrypted = bobSession.decrypt(encrypted);
          expect(new TextDecoder().decode(decrypted)).toBe(msg.text);
        } else {
          const encrypted = bobSession.encrypt(plaintext);
          const decrypted = aliceSession.decrypt(encrypted);
          expect(new TextDecoder().decode(decrypted)).toBe(msg.text);
        }
      }

      // Verify nonce counters
      expect(aliceSession.sendNonce).toBe(3);
      expect(aliceSession.receiveNonce).toBe(2);
      expect(bobSession.sendNonce).toBe(2);
      expect(bobSession.receiveNonce).toBe(3);
    });
  });

  describe('handshake error handling', () => {
    test('rejects tampered handshake message 2', () => {
      const aliceHandshake = new NoiseHandshake();
      const bobHandshake = new NoiseHandshake();

      aliceHandshake.initializeInitiator(aliceStatic);
      bobHandshake.initializeResponder(bobStatic);

      // Message 1 succeeds
      bobHandshake.readMessage1(aliceHandshake.writeMessage1());

      // Get valid message 2
      const msg2 = bobHandshake.writeMessage2();

      // Tamper with it
      msg2[40] ^= 0xFF;

      // Alice should reject tampered message
      expect(() => aliceHandshake.readMessage2(msg2)).toThrow();
    });

    test('rejects tampered handshake message 3', () => {
      const aliceHandshake = new NoiseHandshake();
      const bobHandshake = new NoiseHandshake();

      aliceHandshake.initializeInitiator(aliceStatic);
      bobHandshake.initializeResponder(bobStatic);

      // Messages 1 and 2 succeed
      bobHandshake.readMessage1(aliceHandshake.writeMessage1());
      aliceHandshake.readMessage2(bobHandshake.writeMessage2());

      // Get valid message 3
      const msg3 = aliceHandshake.writeMessage3();

      // Tamper with it
      msg3[10] ^= 0xFF;

      // Bob should reject tampered message
      expect(() => bobHandshake.readMessage3(msg3)).toThrow();
    });

    test('rejects truncated messages', () => {
      const aliceHandshake = new NoiseHandshake();
      const bobHandshake = new NoiseHandshake();

      aliceHandshake.initializeInitiator(aliceStatic);
      bobHandshake.initializeResponder(bobStatic);

      // Get valid message 1 and truncate
      const msg1 = aliceHandshake.writeMessage1();
      const truncated = msg1.subarray(0, 16);

      expect(() => bobHandshake.readMessage1(truncated)).toThrow('too short');
    });
  });

  describe('session security', () => {
    test('different handshakes produce different session keys', async () => {
      // First handshake
      const alice1 = new NoiseHandshake();
      const bob1 = new NoiseHandshake();
      alice1.initializeInitiator(aliceStatic);
      bob1.initializeResponder(bobStatic);
      bob1.readMessage1(alice1.writeMessage1());
      alice1.readMessage2(bob1.writeMessage2());
      bob1.readMessage3(alice1.writeMessage3());
      const session1 = alice1.getSession();

      // Second handshake with same static keys
      const alice2 = new NoiseHandshake();
      const bob2 = new NoiseHandshake();
      alice2.initializeInitiator(aliceStatic);
      bob2.initializeResponder(bobStatic);
      bob2.readMessage1(alice2.writeMessage1());
      alice2.readMessage2(bob2.writeMessage2());
      bob2.readMessage3(alice2.writeMessage3());
      const session2 = alice2.getSession();

      // Encrypt same message with both sessions
      const plaintext = new TextEncoder().encode('Test message');
      const ct1 = session1.encrypt(plaintext);
      const ct2 = session2.encrypt(plaintext);

      // Ciphertexts should be different (different ephemeral keys)
      expect(bytesToHex(ct1)).not.toBe(bytesToHex(ct2));
    });

    test('sessions cannot decrypt messages from other sessions', () => {
      // Handshake between Alice and Bob
      const alice1 = new NoiseHandshake();
      const bob1 = new NoiseHandshake();
      alice1.initializeInitiator(aliceStatic);
      bob1.initializeResponder(bobStatic);
      bob1.readMessage1(alice1.writeMessage1());
      alice1.readMessage2(bob1.writeMessage2());
      bob1.readMessage3(alice1.writeMessage3());
      const aliceSession = alice1.getSession();
      const bobSession = bob1.getSession();

      // Create another pair (Charlie and Dave)
      const charlieStatic = generateKeyPair();
      const daveStatic = generateKeyPair();

      const charlie = new NoiseHandshake();
      const dave = new NoiseHandshake();
      charlie.initializeInitiator(charlieStatic);
      dave.initializeResponder(daveStatic);
      dave.readMessage1(charlie.writeMessage1());
      charlie.readMessage2(dave.writeMessage2());
      dave.readMessage3(charlie.writeMessage3());
      const daveSession = dave.getSession();

      // Alice encrypts for Bob
      const plaintext = new TextEncoder().encode('Secret for Bob');
      const ciphertext = aliceSession.encrypt(plaintext);

      // Bob can decrypt
      const decryptedByBob = bobSession.decrypt(ciphertext);
      expect(decryptedByBob).not.toBeNull();

      // Dave cannot decrypt (different session)
      const decryptedByDave = daveSession.decrypt(ciphertext);
      expect(decryptedByDave).toBeNull();
    });

    test('forward secrecy: compromised static key cannot decrypt past messages', () => {
      // This test verifies the concept - with ephemeral keys,
      // even if static keys are later compromised, past session
      // messages remain secure

      const alice = new NoiseHandshake();
      const bob = new NoiseHandshake();
      alice.initializeInitiator(aliceStatic);
      bob.initializeResponder(bobStatic);
      bob.readMessage1(alice.writeMessage1());
      alice.readMessage2(bob.writeMessage2());
      bob.readMessage3(alice.writeMessage3());

      const aliceSession = alice.getSession();
      const bobSession = bob.getSession();

      // Exchange messages
      const secret = new TextEncoder().encode('Top secret message');
      const ciphertext = aliceSession.encrypt(secret);
      const decrypted = bobSession.decrypt(ciphertext);
      expect(new TextDecoder().decode(decrypted)).toBe('Top secret message');

      // Even with static keys, cannot recreate session
      // (would need the ephemeral keys which are not stored)
      const attackerAlice = new NoiseHandshake();
      const attackerBob = new NoiseHandshake();
      attackerAlice.initializeInitiator(aliceStatic);
      attackerBob.initializeResponder(bobStatic);

      // New handshake creates new ephemeral keys
      attackerBob.readMessage1(attackerAlice.writeMessage1());
      attackerAlice.readMessage2(attackerBob.writeMessage2());
      attackerBob.readMessage3(attackerAlice.writeMessage3());

      const attackerSession = attackerBob.getSession();

      // Cannot decrypt the old ciphertext
      const attackResult = attackerSession.decrypt(ciphertext);
      expect(attackResult).toBeNull();
    });
  });

  describe('transport integration', () => {
    test('handles transport disconnection gracefully', async () => {
      const alice = new NoiseHandshake();
      alice.initializeInitiator(aliceStatic);

      const msg1 = alice.writeMessage1();
      const frame = createFrame(MESSAGE_TYPE.HANDSHAKE_INIT, msg1);

      // Disconnect before sending
      aliceTransport.simulatePeerDisconnect('bob');

      await expect(aliceTransport.send('bob', frame)).rejects.toThrow();
    });

    test('message log captures handshake traffic', async () => {
      const alice = new NoiseHandshake();
      const bob = new NoiseHandshake();
      alice.initializeInitiator(aliceStatic);
      bob.initializeResponder(bobStatic);

      // Clear existing logs
      aliceTransport.clearMessageLog();
      bobTransport.clearMessageLog();

      // Exchange messages
      const msg1 = alice.writeMessage1();
      await aliceTransport.send('bob', createFrame(MESSAGE_TYPE.HANDSHAKE_INIT, msg1));
      await new Promise(r => setTimeout(r, 20));

      bob.readMessage1(msg1);
      const msg2 = bob.writeMessage2();
      await bobTransport.send('alice', createFrame(MESSAGE_TYPE.HANDSHAKE_RESPONSE, msg2));
      await new Promise(r => setTimeout(r, 20));

      alice.readMessage2(msg2);
      const msg3 = alice.writeMessage3();
      await aliceTransport.send('bob', createFrame(MESSAGE_TYPE.HANDSHAKE_FINAL, msg3));
      await new Promise(r => setTimeout(r, 20));

      // Check logs
      const aliceLog = aliceTransport.getMessageLog();
      const bobLog = bobTransport.getMessageLog();

      // Alice sent 2 messages (init, final) and received 1 (response)
      const aliceSent = aliceLog.filter(m => m.type === 'send');
      const aliceReceived = aliceLog.filter(m => m.type === 'receive');
      expect(aliceSent.length).toBe(2);
      expect(aliceReceived.length).toBe(1);

      // Bob sent 1 message (response) and received 2 (init, final)
      const bobSent = bobLog.filter(m => m.type === 'send');
      const bobReceived = bobLog.filter(m => m.type === 'receive');
      expect(bobSent.length).toBe(1);
      expect(bobReceived.length).toBe(2);
    });
  });

  describe('concurrent handshakes', () => {
    test('supports multiple simultaneous handshakes', async () => {
      // Create multiple peers
      const peers = [];
      for (let i = 0; i < 4; i++) {
        peers.push({
          static: generateKeyPair(),
          handshake: new NoiseHandshake()
        });
      }

      // Alice initiates handshakes with all peers
      const aliceHandshakes = [];
      for (let i = 0; i < peers.length; i++) {
        const alice = new NoiseHandshake();
        alice.initializeInitiator(aliceStatic);
        peers[i].handshake.initializeResponder(peers[i].static);
        aliceHandshakes.push(alice);
      }

      // Complete all handshakes in parallel
      const sessions = [];
      for (let i = 0; i < peers.length; i++) {
        peers[i].handshake.readMessage1(aliceHandshakes[i].writeMessage1());
        aliceHandshakes[i].readMessage2(peers[i].handshake.writeMessage2());
        peers[i].handshake.readMessage3(aliceHandshakes[i].writeMessage3());

        sessions.push({
          alice: aliceHandshakes[i].getSession(),
          peer: peers[i].handshake.getSession()
        });
      }

      // Verify all sessions work independently
      for (let i = 0; i < sessions.length; i++) {
        const msg = new TextEncoder().encode(`Message to peer ${i}`);
        const encrypted = sessions[i].alice.encrypt(msg);
        const decrypted = sessions[i].peer.decrypt(encrypted);
        expect(new TextDecoder().decode(decrypted)).toBe(`Message to peer ${i}`);
      }
    });
  });
});
