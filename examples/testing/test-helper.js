#!/usr/bin/env node
/**
 * Testing Helper Example
 *
 * Shows how to use the library in unit tests with MockTransport.
 * Compatible with Jest, Mocha, and other test frameworks.
 *
 * Usage in tests:
 *   const { createTestPair, createTestMesh } = require('react-native-ble-mesh/examples/testing/test-helper');
 */

'use strict';

const { MeshService, MockTransport, MemoryStorage, utils } = require('../../src');

/**
 * Create a single test mesh instance
 * @param {Object} options - Configuration options
 * @param {string} [options.displayName='TestNode'] - Display name
 * @returns {Promise<{mesh: MeshService, transport: MockTransport}>}
 */
async function createTestMesh(options = {}) {
  const mesh = new MeshService({
    displayName: options.displayName || 'TestNode'
  });

  const transport = new MockTransport({ localPeerId: utils.generateUUID() });

  await mesh.initialize({
    storage: new MemoryStorage()
  });

  await mesh.start(transport);

  return { mesh, transport };
}

/**
 * Create a pair of connected test mesh instances
 * @param {Object} options - Configuration options
 * @param {string} [options.name1='Alice'] - First node name
 * @param {string} [options.name2='Bob'] - Second node name
 * @returns {Promise<{alice: MeshService, bob: MeshService, aliceTransport: MockTransport, bobTransport: MockTransport}>}
 */
async function createTestPair(options = {}) {
  const { mesh: alice, transport: aliceTransport } = await createTestMesh({
    displayName: options.name1 || 'Alice'
  });

  const { mesh: bob, transport: bobTransport } = await createTestMesh({
    displayName: options.name2 || 'Bob'
  });

  // Link the transports
  aliceTransport.linkTo(bobTransport);

  return { alice, bob, aliceTransport, bobTransport };
}

/**
 * Create a mesh network of test nodes
 * @param {number} count - Number of nodes to create
 * @param {string} [topology='chain'] - 'chain', 'star', or 'full'
 * @returns {Promise<Array<{mesh: MeshService, transport: MockTransport}>>}
 */
async function createTestNetwork(count, topology = 'chain') {
  const nodes = [];

  // Create nodes
  for (let i = 0; i < count; i++) {
    const node = await createTestMesh({
      displayName: `Node${i + 1}`
    });
    nodes.push(node);
  }

  // Connect based on topology
  switch (topology) {
    case 'chain':
      // A - B - C - D
      for (let i = 0; i < nodes.length - 1; i++) {
        nodes[i].transport.linkTo(nodes[i + 1].transport);
      }
      break;

    case 'star':
      // All connect to first node
      for (let i = 1; i < nodes.length; i++) {
        nodes[0].transport.linkTo(nodes[i].transport);
      }
      break;

    case 'full':
      // Everyone connects to everyone
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          nodes[i].transport.linkTo(nodes[j].transport);
        }
      }
      break;

    default:
      throw new Error(`Unknown topology: ${topology}`);
  }

  return nodes;
}

/**
 * Clean up test mesh instances
 * @param {...MeshService} meshes - Mesh instances to clean up
 */
async function cleanupTestMeshes(...meshes) {
  for (const mesh of meshes) {
    try {
      await mesh.stop();
      await mesh.destroy();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Wait for a specific event with timeout
 * @param {MeshService} mesh - Mesh service instance
 * @param {string} eventName - Event to wait for
 * @param {number} [timeout=5000] - Timeout in ms
 * @returns {Promise<any>} Event data
 */
function waitForEvent(mesh, eventName, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeout);

    mesh.once(eventName, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// Export helpers
module.exports = {
  createTestMesh,
  createTestPair,
  createTestNetwork,
  cleanupTestMeshes,
  waitForEvent
};

// Demo if run directly
if (require.main === module) {
  (async () => {
    console.log('Test Helper Demo\n');

    // Demo: Create a test pair
    console.log('1. Creating test pair...');
    const { alice, bob, aliceTransport, bobTransport } = await createTestPair();
    console.log('   Alice state:', alice.getState());
    console.log('   Bob state:', bob.getState());

    // Demo: Send message
    console.log('\n2. Sending broadcast...');
    alice.sendBroadcast('Test message');

    // Demo: Create network
    console.log('\n3. Creating 4-node chain network...');
    const network = await createTestNetwork(4, 'chain');
    console.log(`   Created ${network.length} nodes`);

    // Cleanup
    console.log('\n4. Cleaning up...');
    await cleanupTestMeshes(alice, bob);
    for (const node of network) {
      await cleanupTestMeshes(node.mesh);
    }

    console.log('\nDemo complete!');
  })().catch(console.error);
}
