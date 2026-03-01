# react-native-ble-mesh

## Send messages without the internet. Like magic! ✨

[![npm version](https://img.shields.io/npm/v/react-native-ble-mesh.svg?style=flat-square)](https://www.npmjs.com/package/react-native-ble-mesh)
[![npm downloads](https://img.shields.io/npm/dm/react-native-ble-mesh.svg?style=flat-square)](https://www.npmjs.com/package/react-native-ble-mesh)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-lightgrey.svg?style=flat-square)](https://reactnative.dev/)
[![Tests](https://img.shields.io/badge/Tests-433%20passing-brightgreen.svg?style=flat-square)]()

---

## What is this?

Imagine you're at a concert, camping trip, or during a power outage — **no WiFi, no cell service**. How do you text your friends?

**This library lets phones talk to each other using Bluetooth!** Messages hop from phone to phone until they reach your friend — even if they're far away.

```
     You                    Friend's                  Your
    Phone  ----Bluetooth---> Friend's  ----Bluetooth---> Friend
                             Phone                      (300m away!)
```

**Think of it like a game of telephone, but for text messages and photos!**

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
| Need to send photos? | Send files & images up to 10MB! |
| Worried about privacy? | Encrypted with battle-tested crypto |
| Phone battery dying? | Smart power saving built-in |
| Need to delete everything fast? | One-tap emergency wipe |
| Using Expo? | Works out of the box! |
| Need faster transfers? | Wi-Fi Direct for big files |
| How's my connection? | Real-time signal quality indicator |

---

## Cool Features

### 📡 Messages That Hop
Your message can jump through **up to 7 phones** to reach someone far away. If Alice can't reach Dave directly, the message goes: Alice → Bob → Carol → Dave!

### 📸 Send Photos & Files
Send pictures, documents, or any file up to 10MB. The library chops it into tiny pieces, sends them through the mesh, and puts them back together on the other side. You get a progress bar too!

```javascript
// Send a photo to a friend
await mesh.sendFile('friend-id', {
  data: photoBytes,          // The file as bytes
  name: 'vacation.jpg',      // File name
  mimeType: 'image/jpeg',    // What kind of file
});

// Watch the progress
mesh.on('fileSendProgress', ({ name, percent }) => {
  console.log(`Sending ${name}: ${percent}%`);
});

// Receive files from others
mesh.on('fileReceived', ({ from, file }) => {
  console.log(`Got ${file.name} from ${from}!`);
  // file.data has the bytes, file.mimeType tells you the type
});
```

### 📶 Connection Quality
See how good your connection is to each person — like signal bars on your phone!

```javascript
const quality = mesh.getConnectionQuality('friend-id');
// quality.level = 'excellent' | 'good' | 'fair' | 'poor'
// quality.rssi = -55 (signal strength)
// quality.latencyMs = 45 (how fast, in milliseconds)

// Get alerted when connection changes
mesh.on('connectionQualityChanged', ({ peerId, level }) => {
  if (level === 'poor') {
    console.log('Connection getting weak! Move closer.');
  }
});
```

### 📡 Wi-Fi Direct for Big Files
Bluetooth is great for messages, but slow for big files. Wi-Fi Direct is **250x faster**! The library automatically picks the best one:

- **Small message?** → Sends via Bluetooth (reliable, low power)
- **Big photo?** → Sends via Wi-Fi Direct (super fast)
- **Wi-Fi Direct not available?** → Falls back to Bluetooth automatically

```javascript
import { MultiTransport } from 'react-native-ble-mesh';

// Use both Bluetooth AND Wi-Fi Direct together
const transport = new MultiTransport({
  bleTransport: myBleTransport,
  wifiTransport: myWifiTransport,
  strategy: 'auto',  // Let the library decide
});

const mesh = new MeshNetwork({ nickname: 'Alex' });
await mesh.start(transport);
// That's it! The library handles everything.
```

### 🔒 Secret Messages
Pick the encryption that works best for your app. The library auto-detects the fastest option:

| Option | Speed | Works On |
|--------|-------|----------|
| `react-native-quick-crypto` | ⚡ Blazing fast | React Native |
| `expo-crypto` + `tweetnacl` | 🚀 Fast | Expo apps |
| `tweetnacl` | ✅ Good | Everywhere |

```javascript
// The library picks the best one automatically!
const mesh = new MeshNetwork({
  nickname: 'Alex',
  crypto: 'auto',  // Auto-detect fastest available
});
```

### 📬 Offline Delivery
Friend's phone turned off? No problem! Your message waits and delivers when they come back online.

### 🔋 Battery Friendly
Choose how much battery to use:
- **High Power** = Faster messages, more battery
- **Balanced** = Good speed, normal battery (default)
- **Low Power** = Slower messages, saves battery
- **Auto** = Let the phone decide based on battery level!

### 🚨 Panic Button
Triple-tap to instantly delete all messages and data. Everything gone in less than 0.2 seconds!

### 💬 Group Channels
Create chat rooms like `#camping-trip` or `#concert-squad`. Only people who join can see the messages!

---

## Installation

### Option A: Expo Projects (Easiest!) 🎯

```bash
npx expo install react-native-ble-mesh react-native-ble-plx react-native-get-random-values
```

Add the plugin to your `app.json`:

```json
{
  "expo": {
    "plugins": [
      ["react-native-ble-mesh", {
        "bluetoothAlwaysPermission": "Chat with nearby friends using Bluetooth"
      }]
    ]
  }
}
```

**That's it! The plugin handles all the permissions for you.** ✅

Then build your dev client:
```bash
npx expo prebuild
npx expo run:ios   # or run:android
```

### Option B: Bare React Native

```bash
npm install react-native-ble-mesh react-native-ble-plx react-native-get-random-values
```

**iOS Setup:**
```bash
cd ios && pod install && cd ..
```

Add to `ios/YourApp/Info.plist`:
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

**Android Setup:** Add to `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

### Final Step (Both Options)

Add this as the **very first line** in your app:

```javascript
import 'react-native-get-random-values';
```

### Optional: Extra Speed & Features

```bash
# Want encryption? Pick one:
npm install tweetnacl                     # Works everywhere
npm install react-native-quick-crypto     # Fastest (native)

# Want Wi-Fi Direct for big file transfers?
npm install react-native-wifi-p2p
```

---

## Quick Start Examples

### Example 1: Simple Chat

```javascript
import { MeshNetwork } from 'react-native-ble-mesh';

const mesh = new MeshNetwork({ nickname: 'YourName' });
await mesh.start();

// Send message to everyone
await mesh.broadcast('Hi everyone!');

// Send private message to one person
await mesh.sendDirect('friend-id', 'Hey, just for you!');

// Receive messages
mesh.on('messageReceived', ({ from, text }) => {
  console.log(`${from}: ${text}`);
});

await mesh.stop();
```

### Example 2: Send a Photo

```javascript
// Send a photo
await mesh.sendFile('friend-id', {
  data: imageBytes,
  name: 'selfie.jpg',
  mimeType: 'image/jpeg',
});

// Track sending progress
mesh.on('fileSendProgress', ({ percent }) => {
  console.log(`${percent}% sent`);
});

// Receive photos
mesh.on('fileReceived', ({ from, file }) => {
  console.log(`Got ${file.name} (${file.size} bytes) from ${from}`);
  // file.data = the photo bytes
  // file.mimeType = 'image/jpeg'
});
```

### Example 3: Group Channels

```javascript
await mesh.joinChannel('#road-trip');
await mesh.sendToChannel('#road-trip', 'Are we there yet?');
await mesh.leaveChannel('#road-trip');
```

### Example 4: Check Connection Quality

```javascript
// How's my connection to a friend?
const quality = mesh.getConnectionQuality('friend-id');
console.log(`Signal: ${quality.level}`);  // excellent, good, fair, poor
console.log(`Speed: ${quality.latencyMs}ms`);

// Check everyone at once
const all = mesh.getAllConnectionQuality();
all.forEach(q => {
  console.log(`${q.peerId}: ${q.level} (${q.transport})`);
});
```

### Example 5: Save Battery

```javascript
const mesh = new MeshNetwork({
  nickname: 'Smart',
  batteryMode: 'auto',  // Adjusts based on your battery level!
});
```

### Example 6: Emergency Delete

```javascript
mesh.enablePanicMode({ trigger: 'triple_tap' });

// Or wipe everything right now
await mesh.wipeAllData();
// All messages, keys, and data = GONE! 💨
```

---

## Using React Hooks

```javascript
import { useMesh, useMessages, usePeers } from 'react-native-ble-mesh/hooks';
import { BLETransport } from 'react-native-ble-mesh';

function ChatScreen() {
  const { mesh, state, initialize, destroy } = useMesh({ displayName: 'Alex' });
  const { messages, sendBroadcast } = useMessages(mesh);
  const { peers, connectedCount } = usePeers(mesh);

  useEffect(() => {
    initialize(new BLETransport());
    return () => destroy();
  }, []);

  if (state !== 'active') return <Text>Starting mesh...</Text>;

  return (
    <View>
      <Text>Connected to {connectedCount} people</Text>
      {messages.map(msg => (
        <Text key={msg.id}>{msg.senderId}: {msg.content}</Text>
      ))}
      <Button title="Say Hi!" onPress={() => sendBroadcast('Hello!')} />
    </View>
  );
}
```

---

## Everything You Can Do

### Starting & Stopping

| Method | What It Does |
|--------|--------------|
| `mesh.start()` | Turn on the mesh network |
| `mesh.stop()` | Turn it off (can restart later) |
| `mesh.destroy()` | Completely shut down |

### Sending Messages

| Method | What It Does |
|--------|--------------|
| `mesh.broadcast('Hi!')` | Send to everyone nearby |
| `mesh.sendDirect(id, 'Hey')` | Private message to one person |
| `mesh.sendToChannel('#fun', 'Yo')` | Send to a group |

### Sending Files

| Method | What It Does |
|--------|--------------|
| `mesh.sendFile(id, { data, name, mimeType })` | Send a file to someone |
| `mesh.getActiveTransfers()` | See files being sent/received |
| `mesh.cancelTransfer(id)` | Cancel a file transfer |

### Connection Quality

| Method | What It Does |
|--------|--------------|
| `mesh.getConnectionQuality(id)` | Signal quality for one person |
| `mesh.getAllConnectionQuality()` | Signal quality for everyone |

### Channels (Group Chats)

| Method | What It Does |
|--------|--------------|
| `mesh.joinChannel('#name')` | Join a group |
| `mesh.leaveChannel('#name')` | Leave a group |
| `mesh.getChannels()` | See your groups |

### People

| Method | What It Does |
|--------|--------------|
| `mesh.getPeers()` | See everyone nearby |
| `mesh.getConnectedPeers()` | See who's connected |
| `mesh.blockPeer(id)` | Block someone |
| `mesh.unblockPeer(id)` | Unblock someone |

### Safety

| Method | What It Does |
|--------|--------------|
| `mesh.enablePanicMode()` | Enable emergency wipe |
| `mesh.wipeAllData()` | Delete everything NOW |

### Network Info

| Method | What It Does |
|--------|--------------|
| `mesh.getStatus()` | Current status |
| `mesh.getNetworkHealth()` | How good is the network? |
| `mesh.getBatteryMode()` | Current battery mode |
| `mesh.setBatteryMode('low')` | Change battery mode |

---

## Events (When Things Happen)

```javascript
// Messages
mesh.on('messageReceived', ({ from, text, type }) => { });
mesh.on('directMessage', ({ from, text }) => { });
mesh.on('channelMessage', ({ channel, from, text }) => { });
mesh.on('messageDelivered', ({ messageId }) => { });

// Files
mesh.on('fileReceived', ({ from, file }) => { });
mesh.on('fileSendProgress', ({ name, percent }) => { });
mesh.on('fileReceiveProgress', ({ name, percent }) => { });
mesh.on('fileTransferFailed', ({ transferId, reason }) => { });

// People
mesh.on('peerDiscovered', (peer) => { });
mesh.on('peerConnected', (peer) => { });
mesh.on('peerDisconnected', (peer) => { });

// Connection Quality
mesh.on('connectionQualityChanged', ({ peerId, level, score }) => { });

// Network
mesh.on('started', () => { });
mesh.on('stopped', () => { });
mesh.on('networkHealthChanged', (info) => { });
mesh.on('error', (error) => { });

// Offline delivery
mesh.on('messageCached', ({ peerId, text }) => { });
mesh.on('cachedMessagesDelivered', ({ peerId, delivered }) => { });

// Safety
mesh.on('dataWiped', (result) => { });
```

---

## How Secure Is It?

**Very secure!** Here's what protects your messages:

| Feature | What It Means (in Simple Words) |
|---------|-------------------------------|
| **Pluggable Encryption** | Choose the strongest lock for your messages |
| **Key Exchange** | Phones secretly agree on a password that nobody else knows |
| **Forward Secrecy** | Even if someone steals your keys later, old messages stay secret |
| **No Permanent IDs** | You can't be tracked — you're just "a phone" |
| **Panic Wipe** | One tap and everything disappears forever |

---

## iOS Background Mode

Want the mesh to keep working when the app is in the background? We've got you covered.

**Short version:** Add `bluetooth-central` and `bluetooth-peripheral` to your background modes (the Expo plugin does this automatically).

**Detailed version:** See our [iOS Background BLE Guide](docs/IOS-BACKGROUND-BLE.md) — covers all the limitations, workarounds, and known bugs.

---

## Frequently Asked Questions

**How far can messages travel?**
One hop: ~30 meters (100 feet). With 7 hops through other phones: 300+ meters!

**Does it work if Bluetooth is off?**
No, Bluetooth must be on. But you don't need WiFi or cell service!

**Can someone read my private messages?**
Nope! They're encrypted. Only you and your friend have the keys.

**How big of a file can I send?**
Up to 10MB by default (configurable). Big files automatically use Wi-Fi Direct if available.

**Does it work with Expo?**
Yes! Just add the plugin to `app.json` and build a dev client.

**Does it drain my battery?**
It uses some battery (Bluetooth is on), but use `batteryMode: 'auto'` and the library manages it for you.

**Does it work in the background?**
On iOS, it works with some limitations (scanning is slower). On Android, it works fully. See [iOS Background BLE Guide](docs/IOS-BACKGROUND-BLE.md).

---

## Use Cases

- 🎵 **Concerts & Festivals** — Text friends when cell towers are overloaded
- ⛺ **Camping & Hiking** — Stay connected in the wilderness
- 🆘 **Emergencies** — Communicate during power outages or disasters
- ✊ **Protests & Events** — When networks are restricted
- 🎮 **Gaming** — Local multiplayer without internet
- 🏫 **Schools** — Classroom activities without WiFi
- 📸 **Photo Sharing** — Share pictures at events without data

---

## Project Structure

```
react-native-ble-mesh/
├── src/
│   ├── index.js              # Main entry point
│   ├── MeshNetwork.js        # High-level API (start here!)
│   ├── crypto/               # Pluggable encryption providers
│   ├── mesh/                 # Routing, dedup, connection quality
│   ├── transport/            # BLE + Wi-Fi Direct + MultiTransport
│   ├── service/              # Messaging, files, audio, battery, panic
│   ├── expo/                 # Expo config plugin
│   └── hooks/                # React hooks
├── docs/                     # Guides & specs
├── app.plugin.js             # Expo plugin entry
└── __tests__/                # 433 tests, 0 failures ✅
```

---

## More Documentation

- [Full API Reference](docs/API.md) — Every method explained
- [React Native Guide](docs/REACT_NATIVE.md) — Platform-specific setup
- [iOS Background BLE](docs/IOS-BACKGROUND-BLE.md) — Background mode guide
- [Security Details](docs/SECURITY.md) — How encryption works
- [Protocol Spec](docs/PROTOCOL.md) — Technical wire format
- [Optimization Notes](docs/OPTIMIZATION.md) — Performance details
- [v2.1 Feature Spec](docs/SPEC-v2.1.md) — Architecture decisions
- [AI/Agent Instructions](docs/prompt-instructions.md) — For AI assistants

---

## Testing

```bash
npm test             # Run all 433 tests
npm run test:coverage  # With coverage report
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

Inspired by [BitChat](https://github.com/nicegram/nicegram-bitchat) — the original decentralized mesh chat.

Built with:
- [react-native-ble-plx](https://github.com/Polidea/react-native-ble-plx) — Bluetooth Low Energy
- [tweetnacl](https://tweetnacl.js.org/) — Encryption

---

## License

MIT License — do whatever you want with it! See [LICENSE](LICENSE) for details.

---

<p align="center">
  <b>Made with ❤️ for a more connected (yet private) world</b>
  <br><br>
  If this library helps you, give it a ⭐ on GitHub!
</p>
