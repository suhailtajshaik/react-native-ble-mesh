'use strict';

/**
 * @fileoverview Tests for message serialization/deserialization
 */

const { serialize, serializeHeader, serializeBatch } = require('../../src/protocol/serializer');
const { deserialize, deserializeHeader } = require('../../src/protocol/deserializer');
const { MessageHeader, HEADER_SIZE } = require('../../src/protocol/header');
const { Message } = require('../../src/protocol/message');
const { crc32 } = require('../../src/protocol/crc32');
const { MESSAGE_TYPE, MESSAGE_FLAGS, MESH_CONFIG } = require('../../src/constants');

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
 * Creates a valid message ID (16 bytes)
 * @returns {Uint8Array}
 */
function createMessageId() {
  const id = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    id[i] = Math.floor(Math.random() * 256);
  }
  return id;
}

describe('Message Serialization', () => {
  describe('serializeHeader()', () => {
    test('serializes header to 48 bytes', () => {
      const header = {
        version: 1,
        type: MESSAGE_TYPE.TEXT,
        flags: MESSAGE_FLAGS.NONE,
        hopCount: 0,
        maxHops: 7,
        messageId: createMessageId(),
        timestamp: Date.now(),
        expiresAt: Date.now() + 1800000,
        payloadLength: 100,
        fragmentIndex: 0,
        fragmentTotal: 1
      };

      const bytes = serializeHeader(header);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(HEADER_SIZE);
    });

    test('serializes version correctly', () => {
      const header = {
        version: 1,
        type: MESSAGE_TYPE.TEXT,
        messageId: createMessageId(),
        timestamp: Date.now(),
        expiresAt: Date.now() + 1800000,
        payloadLength: 0
      };

      const bytes = serializeHeader(header);
      expect(bytes[0]).toBe(1);
    });

    test('serializes message type correctly', () => {
      const header = {
        version: 1,
        type: MESSAGE_TYPE.HANDSHAKE_INIT,
        messageId: createMessageId(),
        timestamp: Date.now(),
        expiresAt: Date.now() + 1800000,
        payloadLength: 0
      };

      const bytes = serializeHeader(header);
      expect(bytes[1]).toBe(MESSAGE_TYPE.HANDSHAKE_INIT);
    });

    test('serializes flags correctly', () => {
      const header = {
        version: 1,
        type: MESSAGE_TYPE.TEXT,
        flags: MESSAGE_FLAGS.ENCRYPTED | MESSAGE_FLAGS.REQUIRES_ACK,
        messageId: createMessageId(),
        timestamp: Date.now(),
        expiresAt: Date.now() + 1800000,
        payloadLength: 0
      };

      const bytes = serializeHeader(header);
      expect(bytes[2]).toBe(MESSAGE_FLAGS.ENCRYPTED | MESSAGE_FLAGS.REQUIRES_ACK);
    });

    test('serializes hop count and max hops correctly', () => {
      const header = {
        version: 1,
        type: MESSAGE_TYPE.TEXT,
        hopCount: 3,
        maxHops: 5,
        messageId: createMessageId(),
        timestamp: Date.now(),
        expiresAt: Date.now() + 1800000,
        payloadLength: 0
      };

      const bytes = serializeHeader(header);
      expect(bytes[3]).toBe(3);
      expect(bytes[4]).toBe(5);
    });

    test('serializes message ID at correct offset', () => {
      const messageId = createMessageId();
      const header = {
        version: 1,
        type: MESSAGE_TYPE.TEXT,
        messageId: messageId,
        timestamp: Date.now(),
        expiresAt: Date.now() + 1800000,
        payloadLength: 0
      };

      const bytes = serializeHeader(header);
      const extractedId = bytes.slice(8, 24);
      expect(bytesToHex(extractedId)).toBe(bytesToHex(messageId));
    });

    test('serializes timestamps as big-endian uint64', () => {
      const timestamp = 1700000000000;
      const expiresAt = 1700001800000;
      const header = {
        version: 1,
        type: MESSAGE_TYPE.TEXT,
        messageId: createMessageId(),
        timestamp: timestamp,
        expiresAt: expiresAt,
        payloadLength: 0
      };

      const bytes = serializeHeader(header);
      const view = new DataView(bytes.buffer, bytes.byteOffset);

      // Read timestamp at offset 24 (big-endian)
      const highTs = view.getUint32(24, false);
      const lowTs = view.getUint32(28, false);
      const readTimestamp = highTs * 0x100000000 + lowTs;
      expect(readTimestamp).toBe(timestamp);

      // Read expiresAt at offset 32 (big-endian)
      const highEx = view.getUint32(32, false);
      const lowEx = view.getUint32(36, false);
      const readExpiresAt = highEx * 0x100000000 + lowEx;
      expect(readExpiresAt).toBe(expiresAt);
    });

    test('serializes payload length as big-endian uint16', () => {
      const header = {
        version: 1,
        type: MESSAGE_TYPE.TEXT,
        messageId: createMessageId(),
        timestamp: Date.now(),
        expiresAt: Date.now() + 1800000,
        payloadLength: 500
      };

      const bytes = serializeHeader(header);
      const view = new DataView(bytes.buffer, bytes.byteOffset);
      expect(view.getUint16(40, false)).toBe(500);
    });

    test('serializes fragment info correctly', () => {
      const header = {
        version: 1,
        type: MESSAGE_TYPE.FRAGMENT,
        messageId: createMessageId(),
        timestamp: Date.now(),
        expiresAt: Date.now() + 1800000,
        payloadLength: 180,
        fragmentIndex: 2,
        fragmentTotal: 5
      };

      const bytes = serializeHeader(header);
      expect(bytes[42]).toBe(2);
      expect(bytes[43]).toBe(5);
    });

    test('calculates and includes CRC32 checksum', () => {
      const header = {
        version: 1,
        type: MESSAGE_TYPE.TEXT,
        messageId: createMessageId(),
        timestamp: Date.now(),
        expiresAt: Date.now() + 1800000,
        payloadLength: 0
      };

      const bytes = serializeHeader(header);

      // Calculate expected checksum over first 44 bytes
      const dataToCheck = bytes.slice(0, 44);
      const expectedChecksum = crc32(dataToCheck);

      // Read checksum from bytes 44-47
      const view = new DataView(bytes.buffer, bytes.byteOffset);
      const actualChecksum = view.getUint32(44, false);

      expect(actualChecksum).toBe(expectedChecksum);
    });

    test('throws for null header', () => {
      expect(() => serializeHeader(null)).toThrow();
    });

    test('throws for invalid messageId', () => {
      const header = {
        version: 1,
        type: MESSAGE_TYPE.TEXT,
        messageId: new Uint8Array(8), // Wrong size
        timestamp: Date.now(),
        expiresAt: Date.now() + 1800000,
        payloadLength: 0
      };

      expect(() => serializeHeader(header)).toThrow('Invalid messageId');
    });
  });

  describe('serialize()', () => {
    test('serializes message with payload', () => {
      const payload = new TextEncoder().encode('Hello, World!');
      const message = Message.create({
        type: MESSAGE_TYPE.TEXT,
        payload: payload
      });

      const bytes = serialize(message);
      expect(bytes.length).toBe(HEADER_SIZE + payload.length);
    });

    test('serializes message with empty payload', () => {
      const message = Message.create({
        type: MESSAGE_TYPE.HEARTBEAT,
        payload: new Uint8Array(0)
      });

      const bytes = serialize(message);
      expect(bytes.length).toBe(HEADER_SIZE);
    });

    test('serializes string payload', () => {
      const content = 'Test message content';
      const message = {
        header: {
          version: 1,
          type: MESSAGE_TYPE.TEXT,
          messageId: createMessageId(),
          timestamp: Date.now(),
          expiresAt: Date.now() + 1800000,
          payloadLength: 0
        },
        payload: content
      };

      const bytes = serialize(message);
      const expectedPayloadLength = new TextEncoder().encode(content).length;
      expect(bytes.length).toBe(HEADER_SIZE + expectedPayloadLength);
    });

    test('throws for null message', () => {
      expect(() => serialize(null)).toThrow();
    });

    test('throws for message without header', () => {
      expect(() => serialize({ payload: new Uint8Array(10) })).toThrow();
    });
  });

  describe('serializeBatch()', () => {
    test('serializes multiple messages', () => {
      const messages = [
        Message.create({ type: MESSAGE_TYPE.TEXT, payload: 'First' }),
        Message.create({ type: MESSAGE_TYPE.TEXT, payload: 'Second' }),
        Message.create({ type: MESSAGE_TYPE.TEXT, payload: 'Third' })
      ];

      const bytes = serializeBatch(messages);

      const expectedLength = messages.reduce((sum, msg) => {
        return sum + HEADER_SIZE + new TextEncoder().encode(msg.getContent()).length;
      }, 0);

      expect(bytes.length).toBe(expectedLength);
    });

    test('returns empty array for empty input', () => {
      const bytes = serializeBatch([]);
      expect(bytes.length).toBe(0);
    });

    test('throws for non-array input', () => {
      expect(() => serializeBatch('not an array')).toThrow();
    });
  });

  describe('round-trip serialization', () => {
    test('deserializes serialized header correctly', () => {
      const original = {
        version: 1,
        type: MESSAGE_TYPE.PRIVATE_MESSAGE,
        flags: MESSAGE_FLAGS.ENCRYPTED,
        hopCount: 2,
        maxHops: 7,
        messageId: createMessageId(),
        timestamp: 1700000000000,
        expiresAt: 1700001800000,
        payloadLength: 256,
        fragmentIndex: 0,
        fragmentTotal: 1
      };

      const bytes = serializeHeader(original);
      const deserialized = deserializeHeader(bytes);

      expect(deserialized.version).toBe(original.version);
      expect(deserialized.type).toBe(original.type);
      expect(deserialized.flags).toBe(original.flags);
      expect(deserialized.hopCount).toBe(original.hopCount);
      expect(deserialized.maxHops).toBe(original.maxHops);
      expect(bytesToHex(deserialized.messageId)).toBe(bytesToHex(original.messageId));
      expect(deserialized.timestamp).toBe(original.timestamp);
      expect(deserialized.expiresAt).toBe(original.expiresAt);
      expect(deserialized.payloadLength).toBe(original.payloadLength);
      expect(deserialized.fragmentIndex).toBe(original.fragmentIndex);
      expect(deserialized.fragmentTotal).toBe(original.fragmentTotal);
    });

    test('deserializes serialized message correctly', () => {
      const original = Message.create({
        type: MESSAGE_TYPE.TEXT,
        payload: 'Hello, Mesh Network!',
        flags: MESSAGE_FLAGS.REQUIRES_ACK
      });

      const bytes = serialize(original);
      const deserialized = deserialize(bytes);

      expect(deserialized.header.type).toBe(original.header.type);
      expect(deserialized.header.flags).toBe(original.header.flags);
      expect(deserialized.getContent()).toBe(original.getContent());
    });

    test('round-trip preserves all message types', () => {
      const types = [
        MESSAGE_TYPE.TEXT,
        MESSAGE_TYPE.HANDSHAKE_INIT,
        MESSAGE_TYPE.HANDSHAKE_RESPONSE,
        MESSAGE_TYPE.HANDSHAKE_FINAL,
        MESSAGE_TYPE.PEER_ANNOUNCE,
        MESSAGE_TYPE.CHANNEL_MESSAGE,
        MESSAGE_TYPE.PRIVATE_MESSAGE,
        MESSAGE_TYPE.HEARTBEAT,
        MESSAGE_TYPE.FRAGMENT
      ];

      for (const type of types) {
        const message = Message.create({
          type: type,
          payload: `Message type ${type}`
        });

        const bytes = serialize(message);
        const deserialized = deserialize(bytes);

        expect(deserialized.header.type).toBe(type);
      }
    });

    test('round-trip preserves fragment information', () => {
      const original = Message.create({
        type: MESSAGE_TYPE.FRAGMENT,
        payload: new Uint8Array(180).fill(0x42),
        fragmentIndex: 3,
        fragmentTotal: 10,
        flags: MESSAGE_FLAGS.IS_FRAGMENT
      });

      const bytes = serialize(original);
      const deserialized = deserialize(bytes);

      expect(deserialized.header.fragmentIndex).toBe(3);
      expect(deserialized.header.fragmentTotal).toBe(10);
      expect(deserialized.isFragment()).toBe(true);
    });

    test('round-trip preserves binary payload', () => {
      const binaryPayload = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        binaryPayload[i] = i;
      }

      const original = Message.create({
        type: MESSAGE_TYPE.PRIVATE_MESSAGE,
        payload: binaryPayload
      });

      const bytes = serialize(original);
      const deserialized = deserialize(bytes);

      expect(bytesToHex(deserialized.payload)).toBe(bytesToHex(binaryPayload));
    });
  });

  describe('CRC32 checksum', () => {
    test('CRC32 of empty input', () => {
      const result = crc32(new Uint8Array(0));
      expect(result).toBe(0);
    });

    test('CRC32 of known value', () => {
      const data = new TextEncoder().encode('123456789');
      const result = crc32(data);
      // Standard CRC32 test value for "123456789"
      expect(result).toBe(0xCBF43926);
    });

    test('CRC32 produces consistent results', () => {
      const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const result1 = crc32(data);
      const result2 = crc32(data);
      expect(result1).toBe(result2);
    });

    test('CRC32 is sensitive to changes', () => {
      const data1 = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const data2 = new Uint8Array([0x01, 0x02, 0x03, 0x05]);
      const result1 = crc32(data1);
      const result2 = crc32(data2);
      expect(result1).not.toBe(result2);
    });

    test('CRC32 throws for non-Uint8Array', () => {
      expect(() => crc32('string')).toThrow('Data must be a Uint8Array');
    });
  });

  describe('deserialization validation', () => {
    test('throws for data shorter than header size', () => {
      expect(() => deserialize(new Uint8Array(20))).toThrow();
    });

    test('throws for incomplete payload', () => {
      const message = Message.create({
        type: MESSAGE_TYPE.TEXT,
        payload: 'Long message content'
      });

      const bytes = serialize(message);
      // Truncate the payload
      const truncated = bytes.slice(0, HEADER_SIZE + 5);

      expect(() => deserialize(truncated)).toThrow();
    });
  });
});
