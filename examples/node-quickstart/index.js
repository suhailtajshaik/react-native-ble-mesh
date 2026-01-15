#!/usr/bin/env node
/**
 * Node.js Quick Start Example
 *
 * This example demonstrates basic usage of the BLE Mesh library in Node.js.
 * It uses the MockTransport for testing without requiring actual BLE hardware.
 *
 * Run with: node examples/node-quickstart/index.js
 */

'use strict';

const { MeshService, MockTransport, MemoryStorage, utils } = require('../../src');

async function main() {
  console.log('BLE Mesh Network - Node.js Quick Start\n');
  console.log('=' .repeat(50));

  // Create two mesh nodes to simulate communication
  const alice = new MeshService({ displayName: 'Alice' });
  const bob = new MeshService({ displayName: 'Bob' });

  // Create mock transports for testing (with unique peer IDs)
  const aliceTransport = new MockTransport({ localPeerId: utils.generateUUID() });
  const bobTransport = new MockTransport({ localPeerId: utils.generateUUID() });

  // Link the transports so they can communicate
  aliceTransport.linkTo(bobTransport);

  // Initialize both nodes
  console.log('\n[1] Initializing nodes...');
  await alice.initialize({ storage: new MemoryStorage() });
  await bob.initialize({ storage: new MemoryStorage() });
  console.log('    Alice initialized');
  console.log('    Bob initialized');

  // Set up event handlers
  alice.on('message', (msg) => {
    console.log(`\n[Alice] Received message: ${msg.type}`);
  });

  bob.on('message', (msg) => {
    console.log(`\n[Bob] Received message: ${msg.type}`);
  });

  alice.on('peer-connected', ({ peerId }) => {
    console.log(`\n[Alice] Peer connected: ${peerId}`);
  });

  bob.on('peer-connected', ({ peerId }) => {
    console.log(`\n[Bob] Peer connected: ${peerId}`);
  });

  // Start both nodes
  console.log('\n[2] Starting nodes...');
  await alice.start(aliceTransport);
  await bob.start(bobTransport);
  console.log('    Alice started');
  console.log('    Bob started');

  // Check status
  console.log('\n[3] Node status:');
  console.log('    Alice:', alice.getState());
  console.log('    Bob:', bob.getState());

  // Get identities
  console.log('\n[4] Node identities:');
  const aliceId = alice.getIdentity();
  const bobId = bob.getIdentity();
  console.log(`    Alice: ${aliceId.displayName}`);
  console.log(`    Bob: ${bobId.displayName}`);

  // Send a broadcast message
  console.log('\n[5] Sending broadcast message...');
  const broadcastId = alice.sendBroadcast('Hello, mesh network!');
  console.log(`    Broadcast sent with ID: ${broadcastId}`);

  // Clean up
  console.log('\n[6] Cleaning up...');
  await alice.stop();
  await bob.stop();
  await alice.destroy();
  await bob.destroy();
  console.log('    Done!');

  console.log('\n' + '=' .repeat(50));
  console.log('Quick start example completed successfully!');
  console.log('\nNext steps:');
  console.log('  - Try the chat example: npm run example:chat');
  console.log('  - Read the docs: docs/API.md');
  console.log('  - For real BLE, install @abandonware/noble\n');
}

main().catch(console.error);
