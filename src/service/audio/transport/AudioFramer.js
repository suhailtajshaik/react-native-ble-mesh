'use strict';

/**
 * @fileoverview Audio frame packing for BLE transport
 * @module audio/transport/AudioFramer
 */

const { MESSAGE_TYPE } = require('../../../constants/protocol');
const { AUDIO_STREAM_CONFIG } = require('../../../constants/audio');

/**
 * Audio frame header size in bytes
 * @constant {number}
 */
const AUDIO_FRAME_HEADER_SIZE = AUDIO_STREAM_CONFIG.FRAME_HEADER_SIZE;

/**
 * Audio frame flags
 * @constant {Object}
 */
const FRAME_FLAGS = Object.freeze({
  NONE: 0x00,
  IS_PLC: 0x01,
  END_OF_UTTERANCE: 0x02,
  PRIORITY: 0x04
});

/**
 * Packs an audio frame with header for transmission
 * @param {Object} options - Frame options
 * @param {number} options.type - Message type
 * @param {Uint8Array} options.frame - Audio frame data
 * @param {number} options.sequenceNumber - Sequence number
 * @param {number} [options.timestampDelta=0] - Timestamp delta
 * @param {number} [options.flags=0] - Frame flags
 * @returns {Uint8Array} Packed frame with header
 */
function packFrame(options) {
  const {
    type,
    frame,
    sequenceNumber,
    timestampDelta = 0,
    flags = FRAME_FLAGS.NONE
  } = options;

  const packedLength = AUDIO_FRAME_HEADER_SIZE + frame.length;
  const packed = new Uint8Array(packedLength);
  const view = new DataView(packed.buffer);

  // Header: [type(1)][flags(1)][seq(2)][timestampDelta(2)][length(2)]
  packed[0] = type;
  packed[1] = flags;
  view.setUint16(2, sequenceNumber & 0xFFFF, false);
  view.setUint16(4, timestampDelta & 0xFFFF, false);
  view.setUint16(6, frame.length, false);

  // Payload
  packed.set(frame, AUDIO_FRAME_HEADER_SIZE);

  return packed;
}

/**
 * Unpacks an audio frame from received data
 * @param {Uint8Array} data - Received data
 * @returns {Object} Unpacked frame info
 */
function unpackFrame(data) {
  if (data.length < AUDIO_FRAME_HEADER_SIZE) {
    throw new Error('Audio frame too short');
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const type = data[0];
  const flags = data[1];
  const sequenceNumber = view.getUint16(2, false);
  const timestampDelta = view.getUint16(4, false);
  const payloadLength = view.getUint16(6, false);

  if (data.length < AUDIO_FRAME_HEADER_SIZE + payloadLength) {
    throw new Error('Audio frame payload truncated');
  }

  const frame = data.slice(AUDIO_FRAME_HEADER_SIZE, AUDIO_FRAME_HEADER_SIZE + payloadLength);

  return {
    type,
    flags,
    sequenceNumber,
    timestampDelta,
    frame,
    isPLC: (flags & FRAME_FLAGS.IS_PLC) !== 0,
    isEndOfUtterance: (flags & FRAME_FLAGS.END_OF_UTTERANCE) !== 0,
    isPriority: (flags & FRAME_FLAGS.PRIORITY) !== 0
  };
}

/**
 * Packs multiple frames into a single packet
 * @param {Array<Object>} frames - Array of frame objects
 * @returns {Uint8Array} Packed multi-frame data
 */
function packMultiFrame(frames) {
  // Format: [count(1)][frame1][frame2]...
  const packedFrames = frames.map(f => packFrame(f));
  const totalLen = 1 + packedFrames.reduce((sum, p) => sum + p.length, 0);

  const result = new Uint8Array(totalLen);
  result[0] = frames.length;

  let offset = 1;
  for (const packed of packedFrames) {
    result.set(packed, offset);
    offset += packed.length;
  }

  return result;
}

/**
 * Unpacks multiple frames from a packet
 * @param {Uint8Array} data - Packed multi-frame data
 * @returns {Array<Object>} Array of unpacked frames
 */
function unpackMultiFrame(data) {
  if (data.length < 1) {
    throw new Error('Multi-frame packet too short');
  }

  const count = data[0];
  const frames = [];
  let offset = 1;

  for (let i = 0; i < count && offset < data.length; i++) {
    // Read header to get payload length
    if (offset + AUDIO_FRAME_HEADER_SIZE > data.length) {
      break;
    }

    const view = new DataView(data.buffer, data.byteOffset + offset, data.length - offset);
    const payloadLength = view.getUint16(6, false);
    const frameLen = AUDIO_FRAME_HEADER_SIZE + payloadLength;

    if (offset + frameLen > data.length) {
      break;
    }

    const frameData = data.slice(offset, offset + frameLen);
    frames.push(unpackFrame(frameData));
    offset += frameLen;
  }

  return frames;
}

/**
 * Creates a stream data frame
 * @param {Uint8Array} audioFrame - LC3 audio frame
 * @param {number} sequenceNumber - Sequence number
 * @param {number} [timestampDelta=0] - Timestamp delta
 * @returns {Uint8Array}
 */
function createStreamFrame(audioFrame, sequenceNumber, timestampDelta = 0) {
  return packFrame({
    type: MESSAGE_TYPE.AUDIO_STREAM_DATA,
    frame: audioFrame,
    sequenceNumber,
    timestampDelta
  });
}

module.exports = {
  AUDIO_FRAME_HEADER_SIZE,
  FRAME_FLAGS,
  packFrame,
  unpackFrame,
  packMultiFrame,
  unpackMultiFrame,
  createStreamFrame
};
