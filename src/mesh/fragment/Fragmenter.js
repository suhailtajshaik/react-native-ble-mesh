'use strict';

/**
 * @fileoverview Message fragmenter for splitting large payloads
 * @module mesh/fragment/Fragmenter
 */

const { MESH_CONFIG } = require('../../constants');
const { ValidationError } = require('../../errors');

/**
 * Default fragment size
 * @constant
 * @private
 */
const DEFAULT_FRAGMENT_SIZE = MESH_CONFIG.FRAGMENT_SIZE;

/**
 * Fragment header overhead (4 bytes: index, total, length high, length low)
 * @constant
 * @private
 */
const FRAGMENT_HEADER_SIZE = 4;

/**
 * Checks if a payload needs fragmentation
 * @param {Uint8Array} payload - Payload to check
 * @param {number} [maxSize] - Maximum fragment payload size
 * @returns {boolean} True if fragmentation is needed
 */
function needsFragmentation(payload, maxSize = DEFAULT_FRAGMENT_SIZE) {
  if (!(payload instanceof Uint8Array)) {
    throw ValidationError.invalidType('payload', payload, 'Uint8Array');
  }
  return payload.length > maxSize;
}

/**
 * Calculates the number of fragments needed
 * @param {number} payloadLength - Total payload length
 * @param {number} maxSize - Maximum fragment payload size
 * @returns {number} Number of fragments required
 * @private
 */
function calculateFragmentCount(payloadLength, maxSize) {
  return Math.ceil(payloadLength / maxSize);
}

/**
 * Creates a fragment header
 * @param {number} index - Fragment index (0-based)
 * @param {number} total - Total number of fragments
 * @param {number} payloadLength - Length of this fragment's payload
 * @returns {Uint8Array} 4-byte fragment header
 * @private
 */
function createFragmentHeader(index, total, payloadLength) {
  const header = new Uint8Array(FRAGMENT_HEADER_SIZE);
  header[0] = index;
  header[1] = total;
  header[2] = (payloadLength >> 8) & 0xff;
  header[3] = payloadLength & 0xff;
  return header;
}

/**
 * Parses a fragment header
 * @param {Uint8Array} data - Fragment data
 * @returns {any} Parsed header { index, total, payloadLength }
 */
function parseFragmentHeader(data) {
  if (data.length < FRAGMENT_HEADER_SIZE) {
    throw ValidationError.invalidArgument('data', null, {
      reason: 'Fragment data too short for header'
    });
  }
  return {
    index: data[0],
    total: data[1],
    payloadLength: (data[2] << 8) | data[3]
  };
}

/**
 * Fragments a payload into multiple chunks
 * @param {Uint8Array} payload - Payload to fragment
 * @param {string} messageId - Message ID for the fragments
 * @param {number} [maxSize] - Maximum fragment payload size
 * @returns {Uint8Array[]} Array of fragment data chunks
 */
function fragment(payload, messageId, maxSize = DEFAULT_FRAGMENT_SIZE) {
  if (!(payload instanceof Uint8Array)) {
    throw ValidationError.invalidType('payload', payload, 'Uint8Array');
  }
  if (typeof messageId !== 'string' || messageId.length === 0) {
    throw ValidationError.invalidArgument('messageId', messageId, {
      reason: 'Message ID must be a non-empty string'
    });
  }
  if (!Number.isInteger(maxSize) || maxSize <= FRAGMENT_HEADER_SIZE) {
    throw ValidationError.outOfRange('maxSize', maxSize, {
      min: FRAGMENT_HEADER_SIZE + 1
    });
  }

  // Calculate actual payload capacity per fragment
  const payloadCapacity = maxSize - FRAGMENT_HEADER_SIZE;
  const fragmentCount = calculateFragmentCount(payload.length, payloadCapacity);

  // Validate fragment count limit (single byte index)
  if (fragmentCount > 255) {
    throw ValidationError.outOfRange('payload.length', payload.length, {
      max: payloadCapacity * 255,
      reason: 'Payload too large, would exceed maximum fragment count'
    });
  }

  const fragments = [];
  let offset = 0;

  for (let i = 0; i < fragmentCount; i++) {
    const remainingLength = payload.length - offset;
    const chunkLength = Math.min(payloadCapacity, remainingLength);
    const chunk = payload.subarray(offset, offset + chunkLength);

    // Create fragment with header
    const header = createFragmentHeader(i, fragmentCount, chunkLength);
    const fragmentData = new Uint8Array(FRAGMENT_HEADER_SIZE + chunkLength);
    fragmentData.set(header, 0);
    fragmentData.set(chunk, FRAGMENT_HEADER_SIZE);

    fragments.push(fragmentData);
    offset += chunkLength;
  }

  return fragments;
}

/**
 * Gets fragment information without parsing full data
 * @param {Uint8Array} fragmentData - Fragment data
 * @returns {any} Fragment info { index, total, payloadLength, payload }
 */
function getFragmentInfo(fragmentData) {
  const header = parseFragmentHeader(fragmentData);
  return {
    ...header,
    payload: fragmentData.slice(FRAGMENT_HEADER_SIZE, FRAGMENT_HEADER_SIZE + header.payloadLength)
  };
}

/**
 * Validates fragment data structure
 * @param {Uint8Array} fragmentData - Fragment data to validate
 * @returns {boolean} True if valid
 */
function isValidFragment(fragmentData) {
  if (!(fragmentData instanceof Uint8Array)) { return false; }
  if (fragmentData.length < FRAGMENT_HEADER_SIZE) { return false; }

  const header = parseFragmentHeader(fragmentData);
  if (header.index >= header.total) { return false; }
  if (header.total === 0) { return false; }
  if (fragmentData.length < FRAGMENT_HEADER_SIZE + header.payloadLength) { return false; }

  return true;
}

module.exports = {
  fragment,
  needsFragmentation,
  parseFragmentHeader,
  getFragmentInfo,
  isValidFragment,
  FRAGMENT_HEADER_SIZE
};
