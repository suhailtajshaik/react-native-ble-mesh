'use strict';

/**
 * @fileoverview React Native hooks for BLE Mesh
 * @module hooks
 *
 * @description
 * React Native hooks for easy integration with BLE Mesh.
 * These hooks handle lifecycle management, state updates, and cleanup.
 *
 * @example
 * import { useMesh, usePeers, useMessages } from 'react-native-ble-mesh/hooks';
 *
 * function App() {
 *   const { mesh, state, initialize } = useMesh({ displayName: 'MyDevice' });
 *   const { peers, connectedPeers } = usePeers(mesh);
 *   const { messages, sendBroadcast } = useMessages(mesh);
 *
 *   // ... your app logic
 * }
 */

const useMesh = require('./useMesh');
const usePeers = require('./usePeers');
const useMessages = require('./useMessages');
const AppStateManager = require('./AppStateManager');

module.exports = {
  useMesh,
  usePeers,
  useMessages,
  AppStateManager
};
