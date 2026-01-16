/**
 * @fileoverview Error code definitions
 * @module constants/errors
 */

'use strict';

/**
 * Error codes organized by category
 * @constant {Object.<string, string>}
 */
const ERROR_CODE = Object.freeze({
  // Initialization errors (E0xx)
  E001: 'INIT_FAILED',
  E002: 'ALREADY_INITIALIZED',
  E003: 'NOT_INITIALIZED',
  E004: 'INVALID_CONFIG',
  E005: 'STORAGE_INIT_FAILED',

  // Bluetooth errors (E1xx)
  E100: 'BLUETOOTH_UNAVAILABLE',
  E101: 'BLUETOOTH_UNAUTHORIZED',
  E102: 'BLUETOOTH_POWERED_OFF',
  E103: 'SCAN_FAILED',
  E104: 'ADVERTISE_FAILED',
  E105: 'MTU_NEGOTIATION_FAILED',

  // Connection errors (E2xx)
  E200: 'CONNECTION_FAILED',
  E201: 'CONNECTION_TIMEOUT',
  E202: 'CONNECTION_LOST',
  E203: 'MAX_CONNECTIONS_REACHED',
  E204: 'PEER_NOT_FOUND',
  E205: 'PEER_BLOCKED',
  E206: 'ALREADY_CONNECTED',
  E207: 'NOT_CONNECTED',

  // Handshake errors (E3xx)
  E300: 'HANDSHAKE_FAILED',
  E301: 'HANDSHAKE_TIMEOUT',
  E302: 'HANDSHAKE_INVALID_STATE',
  E303: 'HANDSHAKE_DECRYPTION_FAILED',
  E304: 'HANDSHAKE_ALREADY_IN_PROGRESS',
  E305: 'HANDSHAKE_INVALID_MESSAGE',

  // Crypto errors (E4xx)
  E400: 'KEY_GENERATION_FAILED',
  E401: 'ENCRYPTION_FAILED',
  E402: 'DECRYPTION_FAILED',
  E403: 'INVALID_KEY',
  E404: 'INVALID_NONCE',
  E405: 'AUTH_TAG_MISMATCH',
  E406: 'NONCE_EXHAUSTED',
  E407: 'INVALID_SIGNATURE',

  // Message errors (E5xx)
  E500: 'MESSAGE_TOO_LARGE',
  E501: 'MESSAGE_EXPIRED',
  E502: 'MESSAGE_INVALID_FORMAT',
  E503: 'MESSAGE_INVALID_CHECKSUM',
  E504: 'MESSAGE_DUPLICATE',
  E505: 'MESSAGE_MAX_HOPS_EXCEEDED',
  E506: 'MESSAGE_SEND_FAILED',
  E507: 'MESSAGE_INVALID_TYPE',
  E508: 'FRAGMENT_ASSEMBLY_FAILED',
  E509: 'FRAGMENT_TIMEOUT',

  // Channel errors (E6xx)
  E600: 'CHANNEL_NOT_FOUND',
  E601: 'CHANNEL_ALREADY_JOINED',
  E602: 'CHANNEL_NOT_JOINED',
  E603: 'CHANNEL_INVALID_PASSWORD',
  E604: 'CHANNEL_FULL',

  // Session errors (E7xx)
  E700: 'SESSION_NOT_FOUND',
  E701: 'SESSION_EXPIRED',
  E702: 'SESSION_INVALID',

  // Validation errors (E8xx)
  E800: 'VALIDATION_FAILED',
  E801: 'INVALID_ARGUMENT',
  E802: 'MISSING_ARGUMENT',
  E803: 'INVALID_TYPE',
  E804: 'OUT_OF_RANGE',

  // General errors (E9xx)
  E900: 'UNKNOWN_ERROR',
  E901: 'OPERATION_CANCELLED',
  E902: 'TIMEOUT',
  E903: 'NOT_SUPPORTED',
  E904: 'INTERNAL_ERROR',

  // Audio errors (EAxx)
  EA00: 'AUDIO_ERROR',
  EA01: 'CODEC_INIT_FAILED',
  EA02: 'ENCODING_FAILED',
  EA03: 'DECODING_FAILED',
  EA04: 'AUDIO_SESSION_FAILED',
  EA05: 'AUDIO_BUFFER_OVERFLOW',
  EA06: 'AUDIO_BUFFER_UNDERRUN',
  EA07: 'VOICE_MESSAGE_TOO_LARGE',
  EA08: 'AUDIO_STREAM_REJECTED',
  EA09: 'CODEC_NOT_AVAILABLE',
  EA10: 'AUDIO_INVALID_CONFIG',
  EA11: 'VOICE_MESSAGE_TIMEOUT'
});

/**
 * Error messages for each error code
 * @constant {Object.<string, string>}
 */
const ERROR_MESSAGES = Object.freeze({
  E001: 'Initialization failed',
  E002: 'Service is already initialized',
  E003: 'Service is not initialized',
  E004: 'Invalid configuration provided',
  E005: 'Storage initialization failed',

  E100: 'Bluetooth is not available on this device',
  E101: 'Bluetooth permission not granted',
  E102: 'Bluetooth is powered off',
  E103: 'Failed to start BLE scan',
  E104: 'Failed to start BLE advertising',
  E105: 'MTU negotiation failed',

  E200: 'Failed to establish connection',
  E201: 'Connection timed out',
  E202: 'Connection was lost',
  E203: 'Maximum number of connections reached',
  E204: 'Peer not found',
  E205: 'Peer is blocked',
  E206: 'Already connected to this peer',
  E207: 'Not connected to this peer',

  E300: 'Handshake failed',
  E301: 'Handshake timed out',
  E302: 'Invalid handshake state',
  E303: 'Failed to decrypt handshake message',
  E304: 'Handshake already in progress with this peer',
  E305: 'Invalid handshake message received',

  E400: 'Failed to generate cryptographic key',
  E401: 'Encryption failed',
  E402: 'Decryption failed',
  E403: 'Invalid key provided',
  E404: 'Invalid nonce provided',
  E405: 'Authentication tag mismatch',
  E406: 'Nonce counter exhausted, rekey required',
  E407: 'Invalid signature',

  E500: 'Message exceeds maximum size',
  E501: 'Message has expired',
  E502: 'Invalid message format',
  E503: 'Message checksum validation failed',
  E504: 'Duplicate message detected',
  E505: 'Message exceeded maximum hop count',
  E506: 'Failed to send message',
  E507: 'Invalid message type',
  E508: 'Failed to assemble message fragments',
  E509: 'Fragment assembly timed out',

  E600: 'Channel not found',
  E601: 'Already joined this channel',
  E602: 'Not a member of this channel',
  E603: 'Invalid channel password',
  E604: 'Channel is full',

  E700: 'Session not found',
  E701: 'Session has expired',
  E702: 'Invalid session',

  E800: 'Validation failed',
  E801: 'Invalid argument provided',
  E802: 'Required argument is missing',
  E803: 'Invalid type',
  E804: 'Value is out of valid range',

  E900: 'An unknown error occurred',
  E901: 'Operation was cancelled',
  E902: 'Operation timed out',
  E903: 'Operation not supported',
  E904: 'Internal error',

  EA00: 'Audio operation failed',
  EA01: 'LC3 codec initialization failed',
  EA02: 'Audio encoding failed',
  EA03: 'Audio decoding failed',
  EA04: 'Audio session failed',
  EA05: 'Audio buffer overflow',
  EA06: 'Audio buffer underrun',
  EA07: 'Voice message exceeds maximum size',
  EA08: 'Audio stream was rejected',
  EA09: 'LC3 codec not available - native module not installed',
  EA10: 'Invalid audio configuration',
  EA11: 'Voice message assembly timed out'
});

module.exports = {
  ERROR_CODE,
  ERROR_MESSAGES
};
