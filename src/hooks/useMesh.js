'use strict';

/**
 * @fileoverview React hook for MeshService
 * @module hooks/useMesh
 */

/**
 * React hook for managing MeshService lifecycle in React Native apps.
 * Handles initialization, cleanup, and state management.
 *
 * @param {Object} [config] - MeshService configuration
 * @param {string} [config.displayName] - Display name for this node
 * @param {Object} [config.storage] - Storage adapter
 * @returns {Object} Mesh state and controls
 *
 * @example
 * function App() {
 *   const { mesh, state, error, initialize, destroy } = useMesh({
 *     displayName: 'MyDevice'
 *   });
 *
 *   useEffect(() => {
 *     initialize();
 *     return () => destroy();
 *   }, []);
 *
 *   if (state === 'error') return <Text>Error: {error.message}</Text>;
 *   if (state !== 'active') return <Text>Loading...</Text>;
 *
 *   return <ChatScreen mesh={mesh} />;
 * }
 */
function useMesh(config = {}) {
  // This hook requires React - check if available
  let React;
  try {
    React = require('react');
  } catch (e) {
    throw new Error('useMesh requires React. Install react as a dependency.');
  }

  const { useState, useCallback, useRef, useEffect } = React;
  const { MeshService } = require('../service');
  const { MemoryStorage } = require('../storage');

  // Create mesh instance ref (persists across renders)
  const meshRef = useRef(null);

  // State
  const [state, setState] = useState('uninitialized');
  const [error, setError] = useState(null);

  // Create mesh instance lazily
  const getMesh = useCallback(() => {
    if (!meshRef.current) {
      meshRef.current = new MeshService({
        displayName: config.displayName || 'MeshNode'
      });
    }
    return meshRef.current;
  }, [config.displayName]);

  // Initialize mesh
  const initialize = useCallback(async (transport) => {
    try {
      setState('initializing');
      setError(null);

      const mesh = getMesh();

      // Setup state change listener
      mesh.on('state-changed', ({ newState }) => {
        setState(newState);
      });

      mesh.on('error', (err) => {
        setError(err);
      });

      // Initialize with storage
      await mesh.initialize({
        storage: config.storage || new MemoryStorage()
      });

      // Start with transport if provided
      if (transport) {
        await mesh.start(transport);
      }

      return mesh;
    } catch (err) {
      setState('error');
      setError(err);
      throw err;
    }
  }, [getMesh, config.storage]);

  // Start with transport
  const start = useCallback(async (transport) => {
    const mesh = getMesh();
    try {
      await mesh.start(transport);
    } catch (err) {
      setError(err);
      throw err;
    }
  }, [getMesh]);

  // Stop mesh
  const stop = useCallback(async () => {
    const mesh = meshRef.current;
    if (mesh) {
      try {
        await mesh.stop();
      } catch (err) {
        setError(err);
      }
    }
  }, []);

  // Destroy mesh
  const destroy = useCallback(async () => {
    const mesh = meshRef.current;
    if (mesh) {
      try {
        await mesh.destroy();
      } catch (err) {
        // Ignore destroy errors
      }
      meshRef.current = null;
      setState('destroyed');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (meshRef.current) {
        meshRef.current.destroy().catch(() => {});
        meshRef.current = null;
      }
    };
  }, []);

  return {
    mesh: meshRef.current,
    state,
    error,
    initialize,
    start,
    stop,
    destroy,
    isReady: state === 'ready' || state === 'active',
    isActive: state === 'active'
  };
}

module.exports = useMesh;
