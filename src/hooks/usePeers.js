'use strict';

/**
 * @fileoverview React hook for peer management
 * @module hooks/usePeers
 */

/**
 * React hook for managing and observing peers in the mesh network.
 * Automatically updates when peers connect, disconnect, or change state.
 *
 * @param {MeshService} mesh - MeshService instance
 * @returns {Object} Peers state and utilities
 *
 * @example
 * function PeerList({ mesh }) {
 *   const { peers, connectedPeers, getPeer } = usePeers(mesh);
 *
 *   return (
 *     <View>
 *       <Text>Connected: {connectedPeers.length}</Text>
 *       {peers.map(peer => (
 *         <PeerItem key={peer.id} peer={peer} />
 *       ))}
 *     </View>
 *   );
 * }
 */
function usePeers(mesh) {
  // This hook requires React
  let React;
  try {
    React = require('react');
  } catch (e) {
    throw new Error('usePeers requires React. Install react as a dependency.');
  }

  const { useState, useEffect, useCallback, useMemo, useRef } = React;

  const [peers, setPeers] = useState([]);
  const lastUpdateRef = useRef(Date.now());

  // Update peers from mesh
  const refreshPeers = useCallback(() => {
    if (mesh) {
      try {
        const allPeers = mesh.getPeers();
        setPeers(prev => {
          if (prev.length === allPeers.length && prev.every((p, i) => p.id === allPeers[i]?.id && p.connectionState === allPeers[i]?.connectionState)) {
            return prev;
          }
          return allPeers;
        });
        lastUpdateRef.current = Date.now();
      } catch (e) {
        // Mesh might not be ready
      }
    }
  }, [mesh]);

  // Subscribe to peer events
  useEffect(() => {
    if (!mesh) { return; }

    const handlePeerEvent = () => refreshPeers();

    mesh.on('peer-discovered', handlePeerEvent);
    mesh.on('peer-connected', handlePeerEvent);
    mesh.on('peer-disconnected', handlePeerEvent);
    mesh.on('peer-secured', handlePeerEvent);

    // Initial load
    refreshPeers();

    return () => {
      mesh.off('peer-discovered', handlePeerEvent);
      mesh.off('peer-connected', handlePeerEvent);
      mesh.off('peer-disconnected', handlePeerEvent);
      mesh.off('peer-secured', handlePeerEvent);
    };
  }, [mesh, refreshPeers]);

  // Computed values
  const connectedPeers = useMemo(() => {
    return peers.filter(p => p.connectionState === 'connected' || p.connectionState === 'secured');
  }, [peers]);

  const securedPeers = useMemo(() => {
    return peers.filter(p => p.connectionState === 'secured');
  }, [peers]);

  // Get single peer by ID (O(1) lookup via peerMap)
  const peerMap = useMemo(() => new Map(peers.map(p => [p.id, p])), [peers]);
  const getPeer = useCallback((peerId) => peerMap.get(peerId), [peerMap]);

  // Check if peer is connected
  const isConnected = useCallback((peerId) => {
    const peer = getPeer(peerId);
    return peer && (peer.connectionState === 'connected' || peer.connectionState === 'secured');
  }, [getPeer]);

  return {
    peers,
    connectedPeers,
    securedPeers,
    peerCount: peers.length,
    connectedCount: connectedPeers.length,
    getPeer,
    isConnected,
    refresh: refreshPeers,
    lastUpdate: lastUpdateRef.current
  };
}

module.exports = usePeers;
