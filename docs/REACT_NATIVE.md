# React Native Integration Guide

This guide covers how to use the BLE Mesh library in React Native applications.

## Installation

```bash
npm install react-native-ble-mesh
```

### Peer Dependencies

Install the BLE library for your platform:

```bash
# React Native
npm install react-native-ble-plx

# Expo
npx expo install react-native-ble-plx
```

### iOS Setup

Add to `ios/Podfile`:
```ruby
pod 'react-native-ble-plx'
```

Add to `Info.plist`:
```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>This app uses Bluetooth to communicate with nearby devices.</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>This app uses Bluetooth to communicate with nearby devices.</string>
<key>UIBackgroundModes</key>
<array>
  <string>bluetooth-central</string>
  <string>bluetooth-peripheral</string>
</array>
```

### Android Setup

Add to `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

## Quick Start with Hooks

The easiest way to use BLE Mesh in React Native is with the provided hooks:

```jsx
import React, { useEffect } from 'react';
import { View, Text, FlatList, Button } from 'react-native';
import { useMesh, usePeers, useMessages, BLETransport } from 'react-native-ble-mesh';

function ChatApp() {
  const { mesh, state, initialize, isActive } = useMesh({
    displayName: 'MyDevice'
  });

  const { peers, connectedPeers } = usePeers(mesh);
  const { messages, sendBroadcast } = useMessages(mesh);

  useEffect(() => {
    async function setup() {
      const transport = new BLETransport();
      await initialize(transport);
    }
    setup();
  }, []);

  if (!isActive) {
    return <Text>Connecting... ({state})</Text>;
  }

  return (
    <View>
      <Text>Connected to {connectedPeers.length} peers</Text>

      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <Text>{item.content}</Text>
        )}
      />

      <Button
        title="Send Hello"
        onPress={() => sendBroadcast('Hello!')}
      />
    </View>
  );
}
```

## Available Hooks

### useMesh(config)

Main hook for managing the MeshService lifecycle.

```jsx
const {
  mesh,           // MeshService instance
  state,          // Current state: 'uninitialized' | 'initializing' | 'ready' | 'active' | 'error'
  error,          // Error object if state is 'error'
  initialize,     // Function to initialize mesh (optionally with transport)
  start,          // Function to start with a transport
  stop,           // Function to stop the mesh
  destroy,        // Function to destroy and cleanup
  isReady,        // Boolean: state is 'ready' or 'active'
  isActive        // Boolean: state is 'active'
} = useMesh({
  displayName: 'MyDevice',  // Optional display name
  storage: customStorage    // Optional custom storage adapter
});
```

### usePeers(mesh)

Hook for managing and observing peers.

```jsx
const {
  peers,           // Array of all known peers
  connectedPeers,  // Array of connected peers
  securedPeers,    // Array of peers with secure sessions
  peerCount,       // Total peer count
  connectedCount,  // Connected peer count
  getPeer,         // Function: getPeer(peerId) => Peer
  isConnected,     // Function: isConnected(peerId) => boolean
  refresh,         // Function to manually refresh peer list
  lastUpdate       // Timestamp of last update
} = usePeers(mesh);
```

### useMessages(mesh, options)

Hook for sending and receiving messages.

```jsx
const {
  messages,        // Array of messages (newest first)
  sending,         // Boolean: currently sending a private message
  error,           // Error from last send attempt
  sendBroadcast,   // Function: sendBroadcast(content) => messageId
  sendPrivate,     // Function: await sendPrivate(peerId, content) => messageId
  sendToChannel,   // Function: sendToChannel(channelId, content) => messageId
  clearMessages,   // Function to clear message history
  messageCount     // Number of messages in state
} = useMessages(mesh, {
  maxMessages: 100  // Maximum messages to keep in state
});
```

## App State Management

Use `AppStateManager` to automatically handle background/foreground transitions:

```jsx
import { useMesh, AppStateManager } from 'react-native-ble-mesh';

function App() {
  const { mesh, initialize } = useMesh();
  const appStateRef = useRef(null);

  useEffect(() => {
    async function setup() {
      await initialize(transport);

      // Setup app state management
      appStateRef.current = new AppStateManager(mesh, {
        backgroundMode: 'ULTRA_POWER_SAVER',
        foregroundMode: 'BALANCED'
      });
      appStateRef.current.initialize();
    }
    setup();

    return () => {
      appStateRef.current?.destroy();
    };
  }, []);

  // ...
}
```

## Power Modes

The library supports different power modes for battery optimization:

```jsx
// Set power mode manually
mesh.setPowerMode('BALANCED');

// Available modes:
// - 'PERFORMANCE': Maximum responsiveness, highest power consumption
// - 'BALANCED': Good balance of responsiveness and battery life
// - 'POWER_SAVER': Reduced responsiveness, lower power consumption
// - 'ULTRA_POWER_SAVER': Minimal power consumption, for background operation
```

## Best Practices

### 1. Permission Handling

Always request Bluetooth permissions before initializing:

```jsx
import { PermissionsAndroid, Platform } from 'react-native';

async function requestPermissions() {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    ]);
    return Object.values(granted).every(
      status => status === PermissionsAndroid.RESULTS.GRANTED
    );
  }
  return true;
}
```

### 2. Cleanup on Unmount

Always cleanup when component unmounts:

```jsx
useEffect(() => {
  initialize(transport);

  return () => {
    destroy();
  };
}, []);
```

### 3. Handle Connection States

Check connection state before sending messages:

```jsx
const handleSend = async (peerId, message) => {
  if (!isConnected(peerId)) {
    Alert.alert('Error', 'Peer is not connected');
    return;
  }

  try {
    await sendPrivate(peerId, message);
  } catch (error) {
    Alert.alert('Send Failed', error.message);
  }
};
```

### 4. Memory Management

The library uses bounded maps and automatic cleanup, but for large message volumes:

```jsx
// Limit messages in state
const { messages } = useMessages(mesh, { maxMessages: 50 });

// Clear old messages periodically
useEffect(() => {
  const interval = setInterval(() => {
    if (messages.length > 100) {
      clearMessages();
    }
  }, 60000);

  return () => clearInterval(interval);
}, [messages.length]);
```

## Troubleshooting

### BLE Not Working

1. Check permissions are granted
2. Ensure Bluetooth is enabled
3. Check device supports BLE
4. Verify peer dependencies are installed

### Connection Issues

1. Ensure devices are within range (~10m for BLE)
2. Check both devices have the app running
3. Try restarting Bluetooth
4. Check for BLE interference

### Performance Issues

1. Use `POWER_SAVER` mode when appropriate
2. Limit message size
3. Use batch operations for multiple messages
4. Clear old messages from state

## Example Project

See the `examples/react-native-app/` directory for a complete example application.
