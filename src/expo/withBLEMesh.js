'use strict';

/**
 * @fileoverview Expo config plugin for react-native-ble-mesh
 * @module expo/withBLEMesh
 *
 * Automatically configures BLE permissions and background modes
 * for iOS and Android when used with Expo.
 *
 * Usage in app.json:
 * {
 *   "expo": {
 *     "plugins": [
 *       ["react-native-ble-mesh", {
 *         "bluetoothAlwaysPermission": "Chat with nearby devices via Bluetooth",
 *         "backgroundModes": ["bluetooth-central", "bluetooth-peripheral"]
 *       }]
 *     ]
 *   }
 * }
 */

/**
 * Default configuration
 * @constant {any}
 */
const DEFAULT_OPTIONS = {
  /** iOS NSBluetoothAlwaysUsageDescription */
  bluetoothAlwaysPermission: 'This app uses Bluetooth to communicate with nearby devices',
  /** iOS UIBackgroundModes */
  backgroundModes: ['bluetooth-central', 'bluetooth-peripheral'],
  /** Android permissions */
  androidPermissions: [
    'android.permission.BLUETOOTH_SCAN',
    'android.permission.BLUETOOTH_CONNECT',
    'android.permission.BLUETOOTH_ADVERTISE',
    'android.permission.ACCESS_FINE_LOCATION'
  ]
};

/**
 * Modifies the iOS Info.plist for BLE permissions.
 * @param {any} config - Expo config
 * @param {any} options - Plugin options
 * @returns {any} Modified config
 */
function withBLEMeshIOS(config, options) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!config.ios) { config.ios = {}; }
  if (!config.ios.infoPlist) { config.ios.infoPlist = {}; }

  // Add Bluetooth usage description
  config.ios.infoPlist.NSBluetoothAlwaysUsageDescription = opts.bluetoothAlwaysPermission;
  config.ios.infoPlist.NSBluetoothPeripheralUsageDescription = opts.bluetoothAlwaysPermission;

  // Add background modes
  const existingModes = config.ios.infoPlist.UIBackgroundModes || [];
  const newModes = new Set([...existingModes, ...opts.backgroundModes]);
  config.ios.infoPlist.UIBackgroundModes = Array.from(newModes);

  return config;
}

/**
 * Modifies the Android manifest for BLE permissions.
 * @param {any} config - Expo config
 * @param {any} options - Plugin options
 * @returns {any} Modified config
 */
function withBLEMeshAndroid(config, options) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!config.android) { config.android = {}; }
  if (!config.android.permissions) { config.android.permissions = []; }

  // Add BLE permissions (avoid duplicates)
  const existingPerms = new Set(config.android.permissions);
  for (const perm of opts.androidPermissions) {
    existingPerms.add(perm);
  }
  config.android.permissions = Array.from(existingPerms);

  return config;
}

/**
 * Main Expo config plugin.
 * @param {any} config - Expo config
 * @param {any} [options={}] - Plugin options
 * @returns {any} Modified config
 */
function withBLEMesh(config, options = {}) {
  config = withBLEMeshIOS(config, options);
  config = withBLEMeshAndroid(config, options);
  return config;
}

module.exports = withBLEMesh;
module.exports.withBLEMeshIOS = withBLEMeshIOS;
module.exports.withBLEMeshAndroid = withBLEMeshAndroid;
module.exports.DEFAULT_OPTIONS = DEFAULT_OPTIONS;
