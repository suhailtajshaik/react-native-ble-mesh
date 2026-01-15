#!/usr/bin/env node
/**
 * Node.js Chat Example
 *
 * A simple terminal-based chat application using the BLE Mesh library.
 * Uses MockTransport for demonstration - replace with BLETransport for real BLE.
 *
 * Run with: node examples/node-chat/chat.js
 */

'use strict';

const readline = require('readline');
const { MeshService, MockTransport, MemoryStorage, utils } = require('../../src');

class ChatApp {
  constructor(name) {
    this.name = name;
    this.mesh = new MeshService({ displayName: name });
    this.transport = new MockTransport({ localPeerId: utils.generateUUID() });
    this.peers = new Map();
  }

  async start() {
    await this.mesh.initialize({ storage: new MemoryStorage() });
    this._setupEventHandlers();
    await this.mesh.start(this.transport);
    console.log(`[${this.name}] Chat started!`);
  }

  _setupEventHandlers() {
    this.mesh.on('peer-connected', ({ peerId }) => {
      console.log(`[+] Peer connected: ${peerId.slice(0, 8)}...`);
    });

    this.mesh.on('peer-disconnected', ({ peerId }) => {
      console.log(`[-] Peer disconnected: ${peerId.slice(0, 8)}...`);
    });

    this.mesh.on('message', (message) => {
      console.log(`[MSG] ${message.senderId?.slice(0, 8) || 'unknown'}: ${message.type}`);
    });

    this.mesh.on('private-message', (message) => {
      const sender = message.senderId?.slice(0, 8) || 'unknown';
      console.log(`[PRIVATE] ${sender}: ${message.content}`);
    });

    this.mesh.on('handshake-complete', ({ peerId }) => {
      console.log(`[SECURE] Handshake completed with: ${peerId.slice(0, 8)}...`);
    });

    this.mesh.on('error', (error) => {
      console.error(`[ERROR] ${error.message}`);
    });
  }

  broadcast(message) {
    const id = this.mesh.sendBroadcast(message);
    console.log(`[SENT] Broadcast: ${message}`);
    return id;
  }

  async sendPrivate(peerId, message) {
    try {
      const id = await this.mesh.sendPrivateMessage(peerId, message);
      console.log(`[SENT] Private to ${peerId.slice(0, 8)}: ${message}`);
      return id;
    } catch (error) {
      console.error(`[FAILED] ${error.message}`);
    }
  }

  linkTo(otherChat) {
    this.transport.linkTo(otherChat.transport);
    console.log(`[LINKED] ${this.name} <-> ${otherChat.name}`);
  }

  getStatus() {
    const status = this.mesh.getStatus();
    return {
      name: this.name,
      state: status.state,
      peers: status.peerCount,
      secured: status.securedPeerCount,
      channels: status.channelCount
    };
  }

  async stop() {
    await this.mesh.stop();
    await this.mesh.destroy();
    console.log(`[${this.name}] Chat stopped.`);
  }
}

// Interactive demo
async function runInteractiveDemo() {
  console.log('\nBLE Mesh Chat Demo');
  console.log('==================\n');

  // Create two chat instances
  const alice = new ChatApp('Alice');
  const bob = new ChatApp('Bob');

  await alice.start();
  await bob.start();

  // Link them together (simulates BLE discovery)
  alice.linkTo(bob);

  console.log('\nBoth chat nodes are running.');
  console.log('Type messages to broadcast from Alice.\n');
  console.log('Commands:');
  console.log('  /status     - Show status of both nodes');
  console.log('  /switch     - Switch to Bob');
  console.log('  /quit       - Exit\n');

  let currentUser = alice;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const prompt = () => {
    rl.question(`[${currentUser.name}] > `, async (input) => {
      input = input.trim();

      if (!input) {
        prompt();
        return;
      }

      if (input === '/quit') {
        await alice.stop();
        await bob.stop();
        rl.close();
        console.log('\nGoodbye!');
        process.exit(0);
      }

      if (input === '/status') {
        console.log('\nStatus:');
        console.log('  Alice:', JSON.stringify(alice.getStatus()));
        console.log('  Bob:', JSON.stringify(bob.getStatus()));
        console.log('');
        prompt();
        return;
      }

      if (input === '/switch') {
        currentUser = currentUser === alice ? bob : alice;
        console.log(`Switched to ${currentUser.name}`);
        prompt();
        return;
      }

      // Send as broadcast
      currentUser.broadcast(input);
      prompt();
    });
  };

  prompt();
}

// Auto demo mode (non-interactive)
async function runAutoDemo() {
  console.log('\nBLE Mesh Chat Auto Demo');
  console.log('=======================\n');

  const alice = new ChatApp('Alice');
  const bob = new ChatApp('Bob');
  const charlie = new ChatApp('Charlie');

  await alice.start();
  await bob.start();
  await charlie.start();

  // Create a mesh: Alice <-> Bob <-> Charlie
  alice.linkTo(bob);
  bob.linkTo(charlie);

  console.log('\nMesh topology: Alice <-> Bob <-> Charlie\n');

  // Simulate some chat
  await sleep(100);
  alice.broadcast('Hello everyone!');
  await sleep(100);
  bob.broadcast('Hey Alice!');
  await sleep(100);
  charlie.broadcast('Hi from Charlie!');

  await sleep(500);

  console.log('\n--- Status ---');
  console.log('Alice:', JSON.stringify(alice.getStatus()));
  console.log('Bob:', JSON.stringify(bob.getStatus()));
  console.log('Charlie:', JSON.stringify(charlie.getStatus()));

  await sleep(100);
  await alice.stop();
  await bob.stop();
  await charlie.stop();

  console.log('\nDemo complete!');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main
const args = process.argv.slice(2);
if (args.includes('--auto')) {
  runAutoDemo().catch(console.error);
} else {
  runInteractiveDemo().catch(console.error);
}
