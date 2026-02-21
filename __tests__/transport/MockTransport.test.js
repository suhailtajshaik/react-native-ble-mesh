'use strict';

const MockTransport = require('../../src/transport/MockTransport');

describe('MockTransport', () => {
  let t1, t2;

  beforeEach(() => {
    t1 = new MockTransport({ localPeerId: 'alice' });
    t2 = new MockTransport({ localPeerId: 'bob' });
  });

  afterEach(async () => {
    try { await t1.stop(); } catch (e) {}
    try { await t2.stop(); } catch (e) {}
  });

  describe('constructor', () => {
    it('auto-generates localPeerId if not provided', () => {
      const t = new MockTransport();
      expect(t.localPeerId).toBeTruthy();
      expect(typeof t.localPeerId).toBe('string');
    });

    it('accepts custom localPeerId', () => {
      expect(t1.localPeerId).toBe('alice');
    });
  });

  describe('linkTo()', () => {
    it('links two transports bidirectionally', () => {
      t1.linkTo(t2);
      t2.linkTo(t1);
      // No assertion needed — just no throw
    });
  });

  describe('start/stop lifecycle', () => {
    it('starts and stops', async () => {
      await t1.start();
      expect(t1.isRunning).toBe(true);
      await t1.stop();
    });
  });

  describe('message passing', () => {
    it('sends messages between linked transports', async () => {
      t1.linkTo(t2);
      t2.linkTo(t1);

      await t1.start();
      await t2.start();

      // Simulate peer connection
      t1.simulatePeerConnect('bob');

      const received = jest.fn();
      t2.on('message', received);

      const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      await t1.send('bob', data);

      // Wait for simulated latency
      await new Promise(r => setTimeout(r, 50));

      expect(received).toHaveBeenCalledWith(
        expect.objectContaining({
          peerId: 'alice',
          data: expect.any(Uint8Array),
        })
      );
    });
  });

  describe('simulatePeerConnect()', () => {
    it('adds a peer', async () => {
      await t1.start();
      t1.simulatePeerConnect('bob');
      expect(t1.getConnectedPeers()).toContain('bob');
    });
  });

  describe('simulatePeerDisconnect()', () => {
    it('removes a peer', async () => {
      await t1.start();
      t1.simulatePeerConnect('bob');
      t1.simulatePeerDisconnect('bob');
      expect(t1.getConnectedPeers()).not.toContain('bob');
    });
  });

  describe('getMessageLog()', () => {
    it('tracks sent messages', async () => {
      t1.linkTo(t2);
      await t1.start();
      t1.simulatePeerConnect('bob');
      await t1.send('bob', new Uint8Array([1, 2]));
      await new Promise(r => setTimeout(r, 50));
      const log = t1.getMessageLog();
      expect(log.length).toBeGreaterThanOrEqual(1);
    });
  });
});
