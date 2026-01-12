/**
 * @fileoverview Event name constants
 * @module constants/events
 */

'use strict';

/**
 * Event names for the mesh network
 * @constant {Object.<string, string>}
 */
const EVENTS = Object.freeze({
  // Lifecycle events
  INITIALIZED: 'initialized',
  DESTROYED: 'destroyed',
  STATE_CHANGED: 'state:changed',
  ERROR: 'error',

  // Bluetooth events
  BLUETOOTH_STATE: 'bluetooth:state',
  SCAN_STARTED: 'scan:started',
  SCAN_STOPPED: 'scan:stopped',

  // Peer events
  PEER_DISCOVERED: 'peer:discovered',
  PEER_CONNECTED: 'peer:connected',
  PEER_DISCONNECTED: 'peer:disconnected',
  PEER_SECURED: 'peer:secured',
  PEER_UPDATED: 'peer:updated',
  PEER_LOST: 'peer:lost',
  PEER_BLOCKED: 'peer:blocked',
  PEER_UNBLOCKED: 'peer:unblocked',

  // Handshake events
  HANDSHAKE_STARTED: 'handshake:started',
  HANDSHAKE_PROGRESS: 'handshake:progress',
  HANDSHAKE_COMPLETE: 'handshake:complete',
  HANDSHAKE_FAILED: 'handshake:failed',

  // Message events
  MESSAGE_RECEIVED: 'message:received',
  MESSAGE_SENT: 'message:sent',
  MESSAGE_FAILED: 'message:failed',
  MESSAGE_RELAYED: 'message:relayed',
  MESSAGE_DROPPED: 'message:dropped',
  MESSAGE_ACK: 'message:ack',

  // Private message events
  PRIVATE_MESSAGE_RECEIVED: 'private:received',
  PRIVATE_MESSAGE_SENT: 'private:sent',

  // Broadcast events
  BROADCAST_RECEIVED: 'broadcast:received',
  BROADCAST_SENT: 'broadcast:sent',

  // Channel events
  CHANNEL_JOINED: 'channel:joined',
  CHANNEL_LEFT: 'channel:left',
  CHANNEL_MESSAGE: 'channel:message',
  CHANNEL_MEMBER_JOINED: 'channel:memberJoined',
  CHANNEL_MEMBER_LEFT: 'channel:memberLeft',

  // Route events
  ROUTE_ADDED: 'route:added',
  ROUTE_UPDATED: 'route:updated',
  ROUTE_REMOVED: 'route:removed',

  // Session events
  SESSION_CREATED: 'session:created',
  SESSION_DESTROYED: 'session:destroyed',
  SESSION_EXPIRED: 'session:expired'
});

module.exports = {
  EVENTS
};
