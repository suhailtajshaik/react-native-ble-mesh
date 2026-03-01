'use strict';

/**
 * @fileoverview React hook for MeshService
 * @module hooks/useMesh
 */

/**
 * React hook for managing MeshService lifecycle in React Native apps.
 * Handles initialization, cleanup, and state management.
 *
 * @param {any} [config] - MeshService configuration
 * @returns {any} Mesh state and controls
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
    // @ts-ignore
    React = require('react');
  } catch (e) {
    throw new Error('useMesh requires React. Install react as a dependency.');
  }

  const { useState, useCallback, useRef, useEffect } = React;
  const { MeshService } = require('../service');
  const { MemoryStorage } = require('../storage');

  // Create mesh instance ref (persists across renders)
  const meshRef = useRef(null);
  const mountedRef = useRef(true);
  const stateHandlerRef = useRef(null);
  const errorHandlerRef = useRef(null);

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
  const initialize = useCallback(async (/** @type {any} */ transport) => {
    try {
      if (!mountedRef.current) { return; }
      setState('initializing');
      setError(null);

      const mesh = getMesh();

      // Remove old listeners if they exist (prevents accumulation on re-init)
      if (stateHandlerRef.current) {
        mesh.off('state-changed', stateHandlerRef.current);
      }
      if (errorHandlerRef.current) {
        mesh.off('error', errorHandlerRef.current);
      }

      // Setup state change listener
      // @ts-ignore
      stateHandlerRef.current = ({ newState }) => {
        if (mountedRef.current) {
          setState(newState);
        }
      };

      errorHandlerRef.current = (/** @type {any} */ err) => {
        if (mountedRef.current) {
          setError(err);
        }
      };

      mesh.on('state-changed', stateHandlerRef.current);
      mesh.on('error', errorHandlerRef.current);

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
      if (mountedRef.current) {
        setState('error');
        setError(err);
      }
      throw err;
    }
  }, [getMesh, config.storage]);

  // Start with transport
  const start = useCallback(async (/** @type {any} */ transport) => {
    const mesh = getMesh();
    try {
      await mesh.start(transport);
    } catch (err) {
      if (mountedRef.current) {
        setError(err);
      }
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
        if (mountedRef.current) {
          setError(err);
        }
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
      if (mountedRef.current) {
        setState('destroyed');
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Immediately mark as unmounted to prevent state updates
      mountedRef.current = false;

      if (meshRef.current) {
        const mesh = meshRef.current;
        meshRef.current = null; // Null ref immediately to prevent new operations

        mesh.destroy().catch(() => {
          // Ignore cleanup errors
        });
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
