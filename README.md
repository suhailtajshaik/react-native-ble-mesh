# react-native-ble-mesh

## Send messages without the internet. Like magic! ✨

[![npm version](https://img.shields.io/npm/v/react-native-ble-mesh.svg?style=flat-square)](https://www.npmjs.com/package/react-native-ble-mesh)
[![npm downloads](https://img.shields.io/npm/dm/react-native-ble-mesh.svg?style=flat-square)](https://www.npmjs.com/package/react-native-ble-mesh)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-lightgrey.svg?style=flat-square)](https://reactnative.dev/)

---

## What is this?

Imagine you're at a concert, camping trip, or during a power outage - **no WiFi, no cell service**. How do you text your friends?

**This library lets phones talk to each other using Bluetooth!** Messages hop from phone to phone until they reach your friend - even if they're far away.

```
     You                    Friend's                  Your
    Phone  ----Bluetooth---> Friend's  ----Bluetooth---> Friend
                             Phone                      (300m away!)
```

**Think of it like a game of telephone, but for text messages!**

---

## See It In Action

```javascript
import { MeshNetwork } from 'react-native-ble-mesh';

// 1. Create your mesh network
const mesh = new MeshNetwork({ nickname: 'Alex' });

// 2. Start it up!
await mesh.start();

// 3. Send a message to everyone nearby
await mesh.broadcast('Hello everyone! 👋');

// 4. Listen for messages
mesh.on('messageReceived', (msg) => {
  console.log(`${msg.from} says: ${msg.text}`);
});
```

**That's it! Four lines of code and you're chatting without internet!**

---

## Why Use This?

| Problem | Our Solution |
|---------|--------------|
| No WiFi or cell service | Works with just Bluetooth! |
| Friend is too far away | Messages hop through other phones |
| Worried about privacy? | All messages are encrypted |
| Phone battery dying? | Smart power saving built-in |
| Need to delete everything fast? | One-tap emergency wipe |

---

## Cool Features

### 📡 Messages That Hop
Your message can jump through **up to 7 phones** to reach someone far away. If Alice can't reach Dave directly, the message goes: Alice → Bob → Carol → Dave!

### 🔒 Secret Messages
Private messages are scrambled (encrypted) so only your friend can read them. Even if someone else's phone passes along the message, they can't peek!

### 📬 Offline Delivery
Friend's phone turned off? No problem! Your message waits and delivers when they come back online.

### 🔋 Battery Friendly
Choose how much battery to use:
- **High Power** = Faster messages, more battery
- **Balanced** = Good speed, normal battery (default)
- **Low Power** = Slower messages, saves battery

### 🚨 Panic Button
Triple-tap to instantly delete all messages and data. Everything gone in less than 0.2 seconds!

### 💬 Group Channels
Create chat rooms like `#camping-trip` or `#concert-squad`. Only people who join can see the messages!

---

## Installation

### Step 1: Install the package

```bash
npm install react-native-ble-mesh react-native-ble-plx react-native-get-random-values
```

### Step 2: iOS Setup

```bash
cd ios && pod install && cd ..
```

Add these lines to your `ios/YourApp/Info.plist`:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Chat with nearby friends using Bluetooth</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>Chat with nearby friends using Bluetooth</string>
<key>UIBackgroundModes</key>
<array>
  <string>bluetooth-central</string>
  <string>bluetooth-peripheral</string>
</array>
```

### Step 3: Android Setup

Add these lines to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

### Step 4: Add this to the TOP of your app

```javascript
// This MUST be the very first line in index.js or App.js
import 'react-native-get-random-values';

// Now add your other imports
import { AppRegistry } from 'react-native';
// ...
```

---

## Quick Start Examples

### Example 1: Simple Chat

```javascript
import { MeshNetwork } from 'react-native-ble-mesh';

// Create and start
const mesh = new MeshNetwork({ nickname: 'YourName' });
await mesh.start();

// Send message to everyone
await mesh.broadcast('Hi everyone!');

// Send private message to one person
await mesh.sendDirect('friend-id-here', 'Hey, just for you!');

// Receive messages
mesh.on('messageReceived', ({ from, text }) => {
  console.log(`${from}: ${text}`);
});

// When done
await mesh.stop();
```

### Example 2: Group Channels

```javascript
// Join a channel (like a chat room)
await mesh.joinChannel('#road-trip');

// Send message to everyone in the channel
await mesh.sendToChannel('#road-trip', 'Are we there yet?');

// Leave when done
await mesh.leaveChannel('#road-trip');
```

### Example 3: Save Battery

```javascript
const mesh = new MeshNetwork({
  nickname: 'PowerSaver',
  batteryMode: 'low',  // Uses less battery
});

// Or let it decide automatically based on battery level
const mesh = new MeshNetwork({
  nickname: 'Smart',
  batteryMode: 'auto',  // Adjusts automatically!
});
```

### Example 4: Emergency Delete

```javascript
// Enable panic mode
mesh.enablePanicMode({
  trigger: 'triple_tap',  // Triple tap to wipe
});

// Or wipe everything immediately
await mesh.wipeAllData();
// All messages, keys, and data = GONE! 💨
```

### Example 5: Check Network Health

```javascript
const health = mesh.getNetworkHealth();

console.log(`Connected to ${health.activeNodes} people`);
console.log(`Network status: ${health.overallHealth}`); // 'good', 'fair', or 'poor'
```

---

## Using React Hooks

If you're using React, we have easy hooks!

```javascript
import { useMesh, useMessages, usePeers } from 'react-native-ble-mesh/hooks';

function ChatScreen() {
  const { mesh, isConnected, start, stop } = useMesh({ nickname: 'Alex' });
  const { messages, sendBroadcast } = useMessages(mesh);
  const { peers } = usePeers(mesh);

  return (
    <View>
      <Text>Connected to {peers.length} people</Text>

      {messages.map(msg => (
        <Text key={msg.id}>{msg.from}: {msg.text}</Text>
      ))}

      <Button title="Say Hi!" onPress={() => sendBroadcast('Hello!')} />
    </View>
  );
}
```

---

## All The Things You Can Do

### Starting & Stopping

| Method | What It Does |
|--------|--------------|
| `mesh.start()` | Turn on the mesh network |
| `mesh.stop()` | Turn it off (can restart later) |
| `mesh.destroy()` | Completely shut down (can't restart) |

### Sending Messages

| Method | What It Does |
|--------|--------------|
| `mesh.broadcast('Hi!')` | Send to everyone nearby |
| `mesh.sendDirect(id, 'Hey')` | Send private message to one person |
| `mesh.sendToChannel('#fun', 'Yo')` | Send to a group channel |

### Channels (Group Chats)

| Method | What It Does |
|--------|--------------|
| `mesh.joinChannel('#name')` | Join a channel |
| `mesh.leaveChannel('#name')` | Leave a channel |
| `mesh.getChannels()` | See what channels you're in |

### People Management

| Method | What It Does |
|--------|--------------|
| `mesh.getPeers()` | See everyone nearby |
| `mesh.blockPeer(id)` | Block someone |
| `mesh.unblockPeer(id)` | Unblock someone |

### Your Identity

| Method | What It Does |
|--------|--------------|
| `mesh.getIdentity()` | Get your info |
| `mesh.setNickname('New Name')` | Change your display name |

### Safety Features

| Method | What It Does |
|--------|--------------|
| `mesh.enablePanicMode()` | Enable emergency wipe |
| `mesh.wipeAllData()` | Delete everything NOW |

### Network Info

| Method | What It Does |
|--------|--------------|
| `mesh.getStatus()` | Get current status |
| `mesh.getNetworkHealth()` | Check how good the network is |
| `mesh.getBatteryMode()` | See current battery mode |
| `mesh.setBatteryMode('low')` | Change battery mode |

---

## Events (When Things Happen)

Listen for these events:

```javascript
// Someone sent a message
mesh.on('messageReceived', ({ from, text }) => { });

// Found a new person nearby
mesh.on('peerDiscovered', ({ peerId }) => { });

// Connected to someone
mesh.on('peerConnected', ({ peerId, displayName }) => { });

// Someone left
mesh.on('peerDisconnected', ({ peerId }) => { });

// Joined a channel
mesh.on('channelJoined', ({ channel }) => { });

// Network quality changed
mesh.on('networkHealthChanged', ({ status }) => { });

// Something went wrong
mesh.on('error', ({ code, message }) => { });
```

---

## How Secure Is It?

**Very secure!** Here's what protects your messages:

| Feature | What It Means |
|---------|---------------|
| **Noise Protocol** | Military-grade handshake to verify who you're talking to |
| **ChaCha20 Encryption** | Your messages are scrambled so only the recipient can read them |
| **Forward Secrecy** | Even if someone steals your keys later, old messages stay secret |
| **No Permanent IDs** | You don't have a permanent identity that can be tracked |

---

## Frequently Asked Questions

### How far can messages travel?
With one hop: about 30 meters (100 feet). With 7 hops through other phones: up to 300+ meters!

### Does it work if Bluetooth is off?
No, Bluetooth must be on. But you don't need WiFi or cell service!

### Can someone read my private messages?
No! Private messages are encrypted. Only you and your friend have the keys.

### How many people can be in the network?
The library supports 50+ connected peers at once.

### Does it drain my battery?
It uses some battery (Bluetooth is on), but you can use "low power" mode to minimize drain.

### Does it work in the background?
On iOS, it works with some limitations. On Android, it works fully in the background.

---

## Use Cases

- **Concerts & Festivals** - Text friends when cell towers are overloaded
- **Camping & Hiking** - Stay connected in the wilderness
- **Emergencies** - Communicate during power outages or disasters
- **Protests & Events** - When networks are restricted
- **Gaming** - Local multiplayer without internet
- **Schools** - Classroom activities without WiFi

---

## Project Structure

```
react-native-ble-mesh/
├── src/
│   ├── index.js          # Main entry point
│   ├── MeshNetwork.js    # High-level API
│   ├── crypto/           # Encryption stuff
│   ├── mesh/             # Routing & networking
│   ├── transport/        # Bluetooth layer
│   └── hooks/            # React hooks
├── docs/                 # Documentation
└── __tests__/            # Tests
```

---

## More Documentation

- [Full API Reference](docs/API.md) - Every method explained
- [React Native Guide](docs/REACT_NATIVE.md) - Platform-specific setup
- [Security Details](docs/SECURITY.md) - How encryption works
- [Protocol Spec](docs/PROTOCOL.md) - Technical wire format
- [AI/Agent Instructions](docs/prompt-instructions.md) - For AI assistants

---

## Testing

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage
```

---

## Contributing

We love contributions! Here's how:

1. Fork this repository
2. Create a branch: `git checkout -b my-feature`
3. Make your changes
4. Run tests: `npm test`
5. Push and create a Pull Request

---

## Credits

Inspired by [BitChat](https://github.com/nicegram/nicegram-bitchat) - the original decentralized mesh chat.

Built with:
- [react-native-ble-plx](https://github.com/Polidea/react-native-ble-plx) - Bluetooth Low Energy
- [Noise Protocol](https://noiseprotocol.org/) - Secure handshakes

---

## License

MIT License - do whatever you want with it! See [LICENSE](LICENSE) for details.

---

## Get Help

- **Issues**: [GitHub Issues](https://github.com/suhailtajshaik/react-native-ble-mesh/issues)
- **Questions**: Open a Discussion on GitHub

---

<p align="center">
  <b>Made with ❤️ for a more connected (yet private) world</b>
  <br><br>
  If this library helps you, give it a ⭐ on GitHub!
</p>
