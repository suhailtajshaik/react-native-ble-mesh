# iOS Background BLE Guide

## The Problem

iOS aggressively suspends apps when they're not in the foreground. Without proper configuration, your mesh network will **stop working** the moment users switch to another app or lock their phone.

### What Happens Without Background Mode
- BLE scanning stops within ~10 seconds of backgrounding
- Existing connections stay alive but can't discover new peers
- No new data transfers until app returns to foreground
- After ~30 seconds, the app is fully suspended

---

## The Fix: Core Bluetooth Background Modes

### Step 1: Enable Background Modes

**Expo (app.json):**
```json
{
  "expo": {
    "plugins": [
      ["react-native-ble-mesh", {
        "bluetoothAlwaysPermission": "Chat with nearby devices via Bluetooth",
        "backgroundModes": ["bluetooth-central", "bluetooth-peripheral"]
      }]
    ]
  }
}
```

**Bare React Native (Info.plist):**
```xml
<key>UIBackgroundModes</key>
<array>
  <string>bluetooth-central</string>
  <string>bluetooth-peripheral</string>
</array>

<key>NSBluetoothAlwaysUsageDescription</key>
<string>Chat with nearby devices via Bluetooth</string>

<key>NSBluetoothPeripheralUsageDescription</key>
<string>Allow others to discover and connect to this device</string>
```

### Step 2: Use `bluetooth-central` AND `bluetooth-peripheral`

- **`bluetooth-central`** — allows scanning for and connecting to peripherals in background
- **`bluetooth-peripheral`** — allows advertising and accepting connections in background

**Both are required** for mesh networking. Without `bluetooth-peripheral`, your device can discover others but they can't discover you.

---

## iOS Background BLE Limitations (Even With Background Modes)

### 1. Scanning Is Throttled
- **Foreground:** Scan interval configurable, fast discovery
- **Background:** iOS throttles scan to ~1 scan per ~4-5 minutes
- **Impact:** Peer discovery is significantly slower

**Workaround:** Use `allowDuplicates: false` in scan options. iOS coalesces duplicate advertisements in background but still delivers new devices.

### 2. Advertising Is Modified
- **Foreground:** Full advertising data (name, service UUIDs, manufacturer data)
- **Background:** iOS strips advertising data to just service UUIDs
- **Impact:** Device names and custom data not visible to other devices

**Workaround:** Exchange device info after connection (in the characteristic read), not during advertising. The library already does this during the mesh handshake.

### 3. 128-bit Service UUIDs Only
- **Background:** iOS only allows 128-bit UUIDs in background advertising
- The library already uses 128-bit UUIDs (`BLE_SERVICE_UUID`), so this is handled.

### 4. Connection Intervals Change
- **Background:** iOS increases connection interval to save power
  - Foreground: ~30ms intervals
  - Background: ~150-300ms intervals
- **Impact:** Higher latency, lower throughput

**Workaround:** Set `batteryMode: 'high'` if background performance is critical. The BatteryOptimizer adjusts connection parameters automatically.

### 5. Execution Time Limits
- Background execution continues as long as there are active BLE tasks
- If no BLE activity for ~10 seconds, app may be suspended
- System can terminate the app at any time for memory pressure

**Workaround:** Keep periodic BLE activity:
```js
// The library handles this automatically via NetworkMonitor health probes
const mesh = new MeshNetwork({
  nickname: 'Alice',
  // Health probes keep BLE active in background
  healthCheckIntervalMs: 15000, // Probe every 15s
});
```

---

## State Restoration (iOS 13+)

If iOS terminates your app while it has active BLE connections, Core Bluetooth can **re-launch your app** and restore the connection state.

### How to Enable

The library supports state restoration via the BLE adapter:

```js
import { RNBLEAdapter } from 'react-native-ble-mesh/adapters';

// Pass a restoration identifier
const adapter = new RNBLEAdapter({
  BleManager: BleManager,
  restoreIdentifier: 'com.yourapp.ble-mesh', // Unique per app
});
```

**Note:** `react-native-ble-plx` supports state restoration via `BleManager({ restoreStateIdentifier: '...' })`. The adapter passes this through.

### What Gets Restored
- Active connections
- Pending connection attempts  
- Subscribed characteristics
- Scan filters

### What Doesn't Get Restored
- In-memory mesh state (peer list, routing tables)
- Pending messages in store-and-forward cache

**Workaround:** Use `AsyncStorageAdapter` instead of `MemoryStorage` to persist mesh state:
```js
import { MeshNetwork, AsyncStorageAdapter } from 'react-native-ble-mesh';

const mesh = new MeshNetwork({
  nickname: 'Alice',
  storage: new AsyncStorageAdapter(), // Persists across termination
});
```

---

## Known iOS Bugs & Workarounds

### Bug: BLE Stops After Phone Reboot
**iOS 14-17:** After reboot, BLE may not start until Bluetooth is toggled off/on in Settings.

**Workaround:** Monitor Bluetooth state and show a user prompt:
```js
mesh.on('error', (error) => {
  if (error.code === 'E102') { // BLE_NOT_POWERED_ON
    // Show alert: "Please toggle Bluetooth in Settings"
  }
});
```

### Bug: Background Scanning Stops After ~24 Hours
**iOS 15+:** Some devices stop background scanning after extended periods.

**Workaround:** Periodically restart scanning:
```js
// The library does this automatically in BatteryOptimizer
// For custom control:
setInterval(async () => {
  if (mesh.getStatus().state === 'running') {
    await mesh._transport.stopScanning();
    await mesh._transport.startScanning();
  }
}, 30 * 60 * 1000); // Every 30 minutes
```

### Bug: Disconnection After iOS Update
**iOS major updates:** System may terminate all BLE connections.

**Workaround:** The library's auto-reconnect handles this. Store-and-forward caches messages until reconnection.

---

## Recommended iOS Settings for Mesh Apps

```js
const mesh = new MeshNetwork({
  nickname: 'Alice',
  batteryMode: 'balanced',  // 'high' for always-on mesh
  
  storeAndForward: {
    enabled: true,
    retentionHours: 48,      // Keep messages longer for iOS delays
  },
  
  // Adjust for background behavior
  routing: {
    maxHops: 7,
  },
});
```

---

## Testing Background BLE

### Simulator
⚠️ **iOS Simulator does NOT support Bluetooth.** You must test on real devices.

### Real Device Testing
1. Start the mesh network on 2+ devices
2. Send messages between them (verify foreground works)
3. Background one app (press Home)
4. Wait 30 seconds
5. Send a message from the foreground device
6. Verify the backgrounded device receives it
7. Check for latency increase (expected: 2-5x slower)

### Detox/Appium
Background testing is difficult to automate. Use manual test scripts with specific timing requirements.

---

## Summary

| Feature | Foreground | Background |
|---------|-----------|------------|
| Scanning | Fast, configurable | ~1 per 5 min |
| Advertising | Full data | Service UUIDs only |
| Connections | Low latency (~30ms) | Higher latency (~150-300ms) |
| Data transfer | Full speed | Reduced speed |
| State restoration | N/A | ✅ Supported |
| App termination | N/A | System may kill app |

**Bottom line:** iOS background BLE works, but with significant limitations. Design your app to handle degraded performance gracefully. The library's store-and-forward, battery optimizer, and health monitoring features help manage this automatically.
