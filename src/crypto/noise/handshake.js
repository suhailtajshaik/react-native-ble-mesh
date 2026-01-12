'use strict';

/**
 * Noise Protocol XX Handshake Implementation
 *
 * XX Pattern (mutual authentication with transmitted static keys):
 *   -> e                    (initiator sends ephemeral public key)
 *   <- e, ee, s, es         (responder: ephemeral, DH, encrypted static)
 *   -> s, se                (initiator: encrypted static, final DH)
 *
 * @module crypto/noise/handshake
 */

const { SymmetricState, PROTOCOL_NAME } = require('./state');
const { generateKeyPair, scalarMult } = require('../x25519');
const { concat } = require('../../utils/bytes');

/**
 * Handshake state machine states
 * @enum {string}
 */
const HandshakeState = {
  INITIAL: 'INITIAL',
  MSG1_WRITTEN: 'MSG1_WRITTEN',
  MSG1_READ: 'MSG1_READ',
  MSG2_WRITTEN: 'MSG2_WRITTEN',
  MSG2_READ: 'MSG2_READ',
  MSG3_WRITTEN: 'MSG3_WRITTEN',
  MSG3_READ: 'MSG3_READ',
  COMPLETE: 'COMPLETE',
  ERROR: 'ERROR'
};

/**
 * Role in the handshake
 * @enum {string}
 */
const Role = {
  INITIATOR: 'INITIATOR',
  RESPONDER: 'RESPONDER'
};

/**
 * Public key size in bytes
 * @constant {number}
 */
const PUBLIC_KEY_SIZE = 32;

/**
 * AEAD tag size in bytes
 * @constant {number}
 */
const TAG_SIZE = 16;

/**
 * NoiseHandshake implements the XX handshake pattern.
 * @class
 */
class NoiseHandshake {
  constructor() {
    /** @type {SymmetricState|null} */
    this._symmetricState = null;

    /** @type {string} */
    this._state = HandshakeState.INITIAL;

    /** @type {string|null} */
    this._role = null;

    /** @type {{publicKey: Uint8Array, secretKey: Uint8Array}|null} */
    this._staticKeyPair = null;

    /** @type {{publicKey: Uint8Array, secretKey: Uint8Array}|null} */
    this._ephemeralKeyPair = null;

    /** @type {Uint8Array|null} */
    this._remoteStaticPublicKey = null;

    /** @type {Uint8Array|null} */
    this._remoteEphemeralPublicKey = null;

    /** @type {{sendKey: Uint8Array, receiveKey: Uint8Array}|null} */
    this._transportKeys = null;
  }

  /**
   * Initializes the handshake as the initiator.
   * @param {{publicKey: Uint8Array, secretKey: Uint8Array}} staticKeyPair
   */
  initializeInitiator(staticKeyPair) {
    if (this._role !== null) {
      throw new Error('Invalid state: handshake already initialized');
    }
    this._validateState(HandshakeState.INITIAL, 'initializeInitiator');
    this._validateKeyPair(staticKeyPair, 'static');

    this._role = Role.INITIATOR;
    this._staticKeyPair = staticKeyPair;
    this._symmetricState = new SymmetricState(PROTOCOL_NAME);

    // Prologue can be empty for basic use
    this._symmetricState.mixHash(new Uint8Array(0));
  }

  /**
   * Initializes the handshake as the responder.
   * @param {{publicKey: Uint8Array, secretKey: Uint8Array}} staticKeyPair
   */
  initializeResponder(staticKeyPair) {
    if (this._role !== null) {
      throw new Error('Invalid state: handshake already initialized');
    }
    this._validateState(HandshakeState.INITIAL, 'initializeResponder');
    this._validateKeyPair(staticKeyPair, 'static');

    this._role = Role.RESPONDER;
    this._staticKeyPair = staticKeyPair;
    this._symmetricState = new SymmetricState(PROTOCOL_NAME);

    // Prologue can be empty for basic use
    this._symmetricState.mixHash(new Uint8Array(0));
  }

  /**
   * Writes message 1: -> e
   * Initiator sends ephemeral public key.
   * @returns {Uint8Array} Message 1 data
   */
  writeMessage1() {
    this._validateRole(Role.INITIATOR, 'writeMessage1');
    this._validateState(HandshakeState.INITIAL, 'writeMessage1');

    // Generate ephemeral key pair
    this._ephemeralKeyPair = generateKeyPair();

    // e: Mix ephemeral public key into hash
    this._symmetricState.mixHash(this._ephemeralKeyPair.publicKey);

    this._state = HandshakeState.MSG1_WRITTEN;
    return new Uint8Array(this._ephemeralKeyPair.publicKey);
  }

  /**
   * Reads message 1: -> e
   * Responder receives initiator's ephemeral public key.
   * @param {Uint8Array} data - Message 1 data
   */
  readMessage1(data) {
    this._validateRole(Role.RESPONDER, 'readMessage1');
    this._validateState(HandshakeState.INITIAL, 'readMessage1');

    if (data.length < PUBLIC_KEY_SIZE) {
      throw new Error('Message 1 too short');
    }

    // Extract remote ephemeral public key
    this._remoteEphemeralPublicKey = data.subarray(0, PUBLIC_KEY_SIZE);

    // e: Mix remote ephemeral into hash
    this._symmetricState.mixHash(this._remoteEphemeralPublicKey);

    this._state = HandshakeState.MSG1_READ;
  }

  /**
   * Writes message 2: <- e, ee, s, es
   * Responder sends ephemeral, performs DH, sends encrypted static.
   * @returns {Uint8Array} Message 2 data
   */
  writeMessage2() {
    this._validateRole(Role.RESPONDER, 'writeMessage2');
    this._validateState(HandshakeState.MSG1_READ, 'writeMessage2');

    // Generate ephemeral key pair
    this._ephemeralKeyPair = generateKeyPair();

    // e: Mix our ephemeral public key into hash
    this._symmetricState.mixHash(this._ephemeralKeyPair.publicKey);

    // ee: DH(ephemeral, remoteEphemeral)
    const ee = scalarMult(
      this._ephemeralKeyPair.secretKey,
      this._remoteEphemeralPublicKey
    );
    this._symmetricState.mixKey(ee);

    // s: Encrypt and send static public key
    const encryptedStatic = this._symmetricState.encryptAndHash(
      this._staticKeyPair.publicKey
    );

    // es: DH(ephemeral, remoteStatic) - but we dont have it yet in XX
    // Actually in XX responder pattern: es = DH(s, re)
    const es = scalarMult(
      this._staticKeyPair.secretKey,
      this._remoteEphemeralPublicKey
    );
    this._symmetricState.mixKey(es);

    // Combine: e || encrypted_s
    const message = concat(this._ephemeralKeyPair.publicKey, encryptedStatic);

    this._state = HandshakeState.MSG2_WRITTEN;
    return message;
  }

  /**
   * Reads message 2: <- e, ee, s, es
   * Initiator receives and processes responder's message 2.
   * @param {Uint8Array} data - Message 2 data
   */
  readMessage2(data) {
    this._validateRole(Role.INITIATOR, 'readMessage2');
    this._validateState(HandshakeState.MSG1_WRITTEN, 'readMessage2');

    const expectedSize = PUBLIC_KEY_SIZE + PUBLIC_KEY_SIZE + TAG_SIZE;
    if (data.length < expectedSize) {
      throw new Error('Message 2 too short');
    }

    // e: Extract and mix remote ephemeral
    this._remoteEphemeralPublicKey = data.subarray(0, PUBLIC_KEY_SIZE);
    this._symmetricState.mixHash(this._remoteEphemeralPublicKey);

    // ee: DH(ephemeral, remoteEphemeral)
    const ee = scalarMult(
      this._ephemeralKeyPair.secretKey,
      this._remoteEphemeralPublicKey
    );
    this._symmetricState.mixKey(ee);

    // s: Decrypt remote static public key
    const encryptedStatic = data.subarray(
      PUBLIC_KEY_SIZE,
      PUBLIC_KEY_SIZE + PUBLIC_KEY_SIZE + TAG_SIZE
    );
    this._remoteStaticPublicKey = this._symmetricState.decryptAndHash(
      encryptedStatic
    );

    // es: DH(e, rs)
    const es = scalarMult(
      this._ephemeralKeyPair.secretKey,
      this._remoteStaticPublicKey
    );
    this._symmetricState.mixKey(es);

    this._state = HandshakeState.MSG2_READ;
  }

  /**
   * Writes message 3: -> s, se
   * Initiator sends encrypted static and performs final DH.
   * @returns {Uint8Array} Message 3 data
   */
  writeMessage3() {
    this._validateRole(Role.INITIATOR, 'writeMessage3');
    this._validateState(HandshakeState.MSG2_READ, 'writeMessage3');

    // s: Encrypt and send static public key
    const encryptedStatic = this._symmetricState.encryptAndHash(
      this._staticKeyPair.publicKey
    );

    // se: DH(s, re)
    const se = scalarMult(
      this._staticKeyPair.secretKey,
      this._remoteEphemeralPublicKey
    );
    this._symmetricState.mixKey(se);

    // Split to get transport keys
    const { sendKey, receiveKey } = this._symmetricState.split();
    this._transportKeys = { sendKey, receiveKey };

    this._state = HandshakeState.MSG3_WRITTEN;
    return encryptedStatic;
  }

  /**
   * Reads message 3: -> s, se
   * Responder receives and processes initiator's message 3.
   * @param {Uint8Array} data - Message 3 data
   */
  readMessage3(data) {
    this._validateRole(Role.RESPONDER, 'readMessage3');
    this._validateState(HandshakeState.MSG2_WRITTEN, 'readMessage3');

    const expectedSize = PUBLIC_KEY_SIZE + TAG_SIZE;
    if (data.length < expectedSize) {
      throw new Error('Message 3 too short');
    }

    // s: Decrypt remote static public key
    this._remoteStaticPublicKey = this._symmetricState.decryptAndHash(data);

    // se: DH(e, rs)
    const se = scalarMult(
      this._ephemeralKeyPair.secretKey,
      this._remoteStaticPublicKey
    );
    this._symmetricState.mixKey(se);

    // Split to get transport keys (reversed for responder)
    const { sendKey, receiveKey } = this._symmetricState.split();
    this._transportKeys = { sendKey: receiveKey, receiveKey: sendKey };

    this._state = HandshakeState.MSG3_READ;
  }

  /**
   * Checks if the handshake is complete.
   * @returns {boolean} True if handshake is complete
   */
  isComplete() {
    return this._state === HandshakeState.MSG3_WRITTEN ||
           this._state === HandshakeState.MSG3_READ;
  }

  /**
   * Gets the NoiseSession for transport encryption.
   * @returns {import('./session').NoiseSession} Transport session
   * @throws {Error} If handshake is not complete
   */
  getSession() {
    if (!this.isComplete()) {
      throw new Error('Handshake not complete');
    }

    const { NoiseSession } = require('./session');
    return new NoiseSession(
      this._transportKeys.sendKey,
      this._transportKeys.receiveKey,
      this._role === Role.INITIATOR
    );
  }

  /**
   * Gets the remote peer's static public key.
   * @returns {Uint8Array|null} Remote static public key or null
   */
  getRemotePublicKey() {
    return this._remoteStaticPublicKey
      ? new Uint8Array(this._remoteStaticPublicKey)
      : null;
  }

  /**
   * Gets the current handshake hash (channel binding).
   * @returns {Uint8Array} Handshake hash
   */
  getHandshakeHash() {
    if (!this._symmetricState) {
      throw new Error('Handshake not initialized');
    }
    return this._symmetricState.getHandshakeHash();
  }

  /**
   * Validates that the current state matches expected.
   * @param {string} expected - Expected state
   * @param {string} operation - Operation name for error message
   * @private
   */
  _validateState(expected, operation) {
    if (this._state !== expected) {
      throw new Error(
        `Invalid state for ${operation}: expected ${expected}, got ${this._state}`
      );
    }
  }

  /**
   * Validates that the role matches expected.
   * @param {string} expected - Expected role
   * @param {string} operation - Operation name for error message
   * @private
   */
  _validateRole(expected, operation) {
    if (this._role !== expected) {
      throw new Error(
        `Invalid role for ${operation}: expected ${expected}, got ${this._role}`
      );
    }
  }

  /**
   * Validates a key pair.
   * @param {object} keyPair - Key pair to validate
   * @param {string} name - Name for error message
   * @private
   */
  _validateKeyPair(keyPair, name) {
    if (!keyPair || !keyPair.publicKey || !keyPair.secretKey) {
      throw new Error(`Invalid ${name} key pair`);
    }
    if (keyPair.publicKey.length !== PUBLIC_KEY_SIZE) {
      throw new Error(`${name} public key must be ${PUBLIC_KEY_SIZE} bytes`);
    }
    if (keyPair.secretKey.length !== PUBLIC_KEY_SIZE) {
      throw new Error(`${name} secret key must be ${PUBLIC_KEY_SIZE} bytes`);
    }
  }
}

module.exports = {
  NoiseHandshake,
  HandshakeState,
  Role
};
