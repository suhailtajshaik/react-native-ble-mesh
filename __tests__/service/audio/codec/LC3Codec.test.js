'use strict';

const LC3Codec = require('../../../../src/service/audio/codec/LC3Codec');
const AudioError = require('../../../../src/errors/AudioError');

describe('LC3Codec', () => {
  describe('constructor', () => {
    test('creates codec with default options', () => {
      const codec = new LC3Codec();
      const config = codec.getConfig();

      expect(config.sampleRate).toBe(16000);
      expect(config.frameMs).toBe(10);
      expect(config.bitRate).toBe(24000);
      expect(config.channels).toBe(1);
    });

    test('accepts custom sample rate', () => {
      const codec = new LC3Codec({ sampleRate: 24000 });
      expect(codec.getConfig().sampleRate).toBe(24000);
    });

    test('accepts custom frame duration', () => {
      const codec = new LC3Codec({ frameMs: 7.5 });
      expect(codec.getConfig().frameMs).toBe(7.5);
    });

    test('accepts custom bit rate', () => {
      const codec = new LC3Codec({ bitRate: 32000 });
      expect(codec.getConfig().bitRate).toBe(32000);
    });

    test('accepts quality preset', () => {
      const codec = new LC3Codec({ quality: 'HIGH' });
      const config = codec.getConfig();
      expect(config.sampleRate).toBe(24000);
      expect(config.bitRate).toBe(32000);
    });

    test('throws for invalid sample rate', () => {
      expect(() => new LC3Codec({ sampleRate: 12000 }))
        .toThrow(AudioError);
    });

    test('throws for invalid frame duration', () => {
      expect(() => new LC3Codec({ frameMs: 15 }))
        .toThrow(AudioError);
    });
  });

  describe('initialize()', () => {
    test('initializes codec (mock mode)', async () => {
      const codec = new LC3Codec();
      await codec.initialize();

      expect(codec.isInitialized()).toBe(true);
      expect(codec.isMock()).toBe(true);
    });

    test('emits initialized event', async () => {
      const codec = new LC3Codec();
      const handler = jest.fn();
      codec.on('initialized', handler);

      await codec.initialize();

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        sampleRate: 16000,
        isMock: true
      }));
    });

    test('does not reinitialize if already initialized', async () => {
      const codec = new LC3Codec();
      await codec.initialize();
      await codec.initialize(); // Should not throw

      expect(codec.isInitialized()).toBe(true);
    });
  });

  describe('getFrameSamples()', () => {
    test('returns correct samples for 16kHz 10ms', () => {
      const codec = new LC3Codec({ sampleRate: 16000, frameMs: 10 });
      expect(codec.getFrameSamples()).toBe(160);
    });

    test('returns correct samples for 24kHz 10ms', () => {
      const codec = new LC3Codec({ sampleRate: 24000, frameMs: 10 });
      expect(codec.getFrameSamples()).toBe(240);
    });

    test('returns correct samples for 16kHz 7.5ms', () => {
      const codec = new LC3Codec({ sampleRate: 16000, frameMs: 7.5 });
      expect(codec.getFrameSamples()).toBe(120);
    });
  });

  describe('getFrameBytes()', () => {
    test('returns correct bytes for 24kbps 10ms', () => {
      const codec = new LC3Codec({ bitRate: 24000, frameMs: 10 });
      expect(codec.getFrameBytes()).toBe(30);
    });

    test('returns correct bytes for 32kbps 10ms', () => {
      const codec = new LC3Codec({ bitRate: 32000, frameMs: 10 });
      expect(codec.getFrameBytes()).toBe(40);
    });
  });

  describe('encode() / decode() mock', () => {
    let codec;

    beforeEach(async () => {
      codec = new LC3Codec();
      await codec.initialize();
    });

    afterEach(() => {
      codec.destroy();
    });

    test('encodes PCM samples to LC3 frame', async () => {
      const samples = new Int16Array(160);
      samples.fill(1000);

      const encoded = await codec.encode(samples);

      expect(encoded).toBeInstanceOf(Uint8Array);
      expect(encoded.length).toBe(30); // 24kbps * 10ms / 8000
    });

    test('decodes LC3 frame to PCM samples', async () => {
      const frame = new Uint8Array(30);
      frame.fill(100);

      const decoded = await codec.decode(frame);

      expect(decoded).toBeInstanceOf(Int16Array);
      expect(decoded.length).toBe(160);
    });

    test('throws if not initialized', async () => {
      const uninitCodec = new LC3Codec();
      const samples = new Int16Array(160);

      await expect(uninitCodec.encode(samples))
        .rejects.toThrow(AudioError);
    });

    test('throws for wrong sample count', async () => {
      const samples = new Int16Array(100); // Wrong size

      await expect(codec.encode(samples))
        .rejects.toThrow(AudioError);
    });
  });

  describe('decodePLC()', () => {
    test('returns silence frame for PLC', async () => {
      const codec = new LC3Codec();
      await codec.initialize();

      const plcSamples = await codec.decodePLC();

      expect(plcSamples).toBeInstanceOf(Int16Array);
      expect(plcSamples.length).toBe(160);
      expect(plcSamples.every(s => s === 0)).toBe(true);

      codec.destroy();
    });
  });

  describe('destroy()', () => {
    test('cleans up resources', async () => {
      const codec = new LC3Codec();
      await codec.initialize();

      codec.destroy();

      expect(codec.isInitialized()).toBe(false);
    });
  });
});
