'use strict';

/**
 * @fileoverview React hook for message handling
 * @module hooks/useMessages
 */

/**
 * React hook for sending and receiving messages in the mesh network.
 * Manages message state and provides send functions.
 *
 * @param {MeshService} mesh - MeshService instance
 * @param {Object} [options] - Options
 * @param {number} [options.maxMessages=100] - Maximum messages to keep in state
 * @returns {Object} Messages state and send functions
 *
 * @example
 * function Chat({ mesh, peerId }) {
 *   const { messages, sendPrivate, sendBroadcast } = useMessages(mesh);
 *
 *   const handleSend = async (text) => {
 *     if (peerId) {
 *       await sendPrivate(peerId, text);
 *     } else {
 *       sendBroadcast(text);
 *     }
 *   };
 *
 *   return (
 *     <View>
 *       {messages.map(msg => <Message key={msg.id} data={msg} />)}
 *       <Input onSubmit={handleSend} />
 *     </View>
 *   );
 * }
 */
function useMessages(mesh, options = {}) {
  // This hook requires React
  let React;
  try {
    React = require('react');
  } catch (e) {
    throw new Error('useMessages requires React. Install react as a dependency.');
  }

  const { useState, useEffect, useCallback, useRef } = React;

  const maxMessages = options.maxMessages || 100;
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const messageIdRef = useRef(new Set());

  // Add message to state (with dedup)
  const addMessage = useCallback((msg) => {
    if (messageIdRef.current.has(msg.id)) { return; }
    messageIdRef.current.add(msg.id);

    setMessages(prev => {
      const updated = [msg, ...prev];
      // Trim to max messages
      if (updated.length > maxMessages) {
        const removed = updated.slice(maxMessages);
        removed.forEach(m => messageIdRef.current.delete(m.id));
        return updated.slice(0, maxMessages);
      }
      return updated;
    });
  }, [maxMessages]);

  // Subscribe to message events
  useEffect(() => {
    if (!mesh) { return; }

    const handleBroadcast = (data) => {
      addMessage({
        id: data.messageId,
        type: 'broadcast',
        content: data.content,
        senderId: data.peerId,
        timestamp: data.timestamp || Date.now(),
        isOwn: false
      });
    };

    const handlePrivate = (data) => {
      addMessage({
        id: data.messageId,
        type: 'private',
        content: data.content,
        senderId: data.peerId,
        timestamp: data.timestamp || Date.now(),
        isOwn: false
      });
    };

    const handleChannel = (data) => {
      addMessage({
        id: data.messageId,
        type: 'channel',
        content: data.content,
        senderId: data.peerId,
        channelId: data.channelId,
        timestamp: data.timestamp || Date.now(),
        isOwn: false
      });
    };

    mesh.on('broadcast-received', handleBroadcast);
    mesh.on('private-message-received', handlePrivate);
    mesh.on('channel-message-received', handleChannel);

    return () => {
      mesh.off('broadcast-received', handleBroadcast);
      mesh.off('private-message-received', handlePrivate);
      mesh.off('channel-message-received', handleChannel);
      // Clear dedup Set on unmount
      messageIdRef.current.clear();
    };
  }, [mesh, addMessage]);

  // Send broadcast message
  const sendBroadcast = useCallback((content) => {
    if (!mesh) { throw new Error('Mesh not initialized'); }
    setError(null);

    try {
      const messageId = mesh.sendBroadcast(content);
      addMessage({
        id: messageId,
        type: 'broadcast',
        content,
        senderId: mesh.getIdentity()?.id,
        timestamp: Date.now(),
        isOwn: true
      });
      return messageId;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, [mesh, addMessage]);

  // Send private message
  const sendPrivate = useCallback(async (peerId, content) => {
    if (!mesh) { throw new Error('Mesh not initialized'); }
    setError(null);
    setSending(true);

    try {
      const messageId = await mesh.sendPrivateMessage(peerId, content);
      addMessage({
        id: messageId,
        type: 'private',
        content,
        recipientId: peerId,
        senderId: mesh.getIdentity()?.id,
        timestamp: Date.now(),
        isOwn: true
      });
      return messageId;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setSending(false);
    }
  }, [mesh, addMessage]);

  // Send channel message
  const sendToChannel = useCallback((channelId, content) => {
    if (!mesh) { throw new Error('Mesh not initialized'); }
    setError(null);

    try {
      const messageId = mesh.sendChannelMessage(channelId, content);
      addMessage({
        id: messageId,
        type: 'channel',
        content,
        channelId,
        senderId: mesh.getIdentity()?.id,
        timestamp: Date.now(),
        isOwn: true
      });
      return messageId;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, [mesh, addMessage]);

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    messageIdRef.current.clear();
  }, []);

  return {
    messages,
    sending,
    error,
    sendBroadcast,
    sendPrivate,
    sendToChannel,
    clearMessages,
    messageCount: messages.length
  };
}

module.exports = useMessages;
