'use strict';

/**
 * @fileoverview Peer module exports
 * @module mesh/peer
 */

const Peer = require('./Peer');
const PeerManager = require('./PeerManager');
const PeerDiscovery = require('./PeerDiscovery');

module.exports = {
  Peer,
  PeerManager,
  PeerDiscovery
};
