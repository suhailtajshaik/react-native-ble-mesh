'use strict';

const withBLEMesh = require('../../src/expo/withBLEMesh');
const { withBLEMeshIOS, withBLEMeshAndroid, DEFAULT_OPTIONS } = withBLEMesh;

describe('Expo Config Plugin', () => {
  describe('withBLEMesh()', () => {
    it('modifies both iOS and Android config', () => {
      const config = withBLEMesh({});
      expect(config.ios).toBeDefined();
      expect(config.android).toBeDefined();
    });
  });

  describe('withBLEMeshIOS()', () => {
    it('adds Bluetooth usage description', () => {
      const config = withBLEMeshIOS({}, {});
      expect(config.ios.infoPlist.NSBluetoothAlwaysUsageDescription).toBe(
        DEFAULT_OPTIONS.bluetoothAlwaysPermission
      );
    });

    it('accepts custom permission text', () => {
      const config = withBLEMeshIOS({}, {
        bluetoothAlwaysPermission: 'Custom BLE message',
      });
      expect(config.ios.infoPlist.NSBluetoothAlwaysUsageDescription).toBe('Custom BLE message');
    });

    it('adds background modes', () => {
      const config = withBLEMeshIOS({}, {});
      expect(config.ios.infoPlist.UIBackgroundModes).toContain('bluetooth-central');
      expect(config.ios.infoPlist.UIBackgroundModes).toContain('bluetooth-peripheral');
    });

    it('preserves existing background modes', () => {
      const config = withBLEMeshIOS({
        ios: { infoPlist: { UIBackgroundModes: ['audio'] } },
      }, {});
      expect(config.ios.infoPlist.UIBackgroundModes).toContain('audio');
      expect(config.ios.infoPlist.UIBackgroundModes).toContain('bluetooth-central');
    });

    it('does not duplicate modes', () => {
      const config = withBLEMeshIOS({
        ios: { infoPlist: { UIBackgroundModes: ['bluetooth-central'] } },
      }, {});
      const centralCount = config.ios.infoPlist.UIBackgroundModes.filter(
        m => m === 'bluetooth-central'
      ).length;
      expect(centralCount).toBe(1);
    });
  });

  describe('withBLEMeshAndroid()', () => {
    it('adds BLE permissions', () => {
      const config = withBLEMeshAndroid({}, {});
      expect(config.android.permissions).toContain('android.permission.BLUETOOTH_SCAN');
      expect(config.android.permissions).toContain('android.permission.BLUETOOTH_CONNECT');
      expect(config.android.permissions).toContain('android.permission.BLUETOOTH_ADVERTISE');
      expect(config.android.permissions).toContain('android.permission.ACCESS_FINE_LOCATION');
    });

    it('preserves existing permissions', () => {
      const config = withBLEMeshAndroid({
        android: { permissions: ['android.permission.CAMERA'] },
      }, {});
      expect(config.android.permissions).toContain('android.permission.CAMERA');
      expect(config.android.permissions).toContain('android.permission.BLUETOOTH_SCAN');
    });

    it('does not duplicate permissions', () => {
      const config = withBLEMeshAndroid({
        android: { permissions: ['android.permission.BLUETOOTH_SCAN'] },
      }, {});
      const scanCount = config.android.permissions.filter(
        p => p === 'android.permission.BLUETOOTH_SCAN'
      ).length;
      expect(scanCount).toBe(1);
    });
  });

  describe('app.plugin.js', () => {
    it('exports the config plugin', () => {
      const plugin = require('../../app.plugin.js');
      expect(typeof plugin).toBe('function');
    });
  });
});
