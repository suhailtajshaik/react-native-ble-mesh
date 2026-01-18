'use strict';

const { MessageCompressor, compress, decompress } = require('../../src/utils/compression');

describe('MessageCompressor', () => {
    let compressor;

    beforeEach(() => {
        compressor = new MessageCompressor({ threshold: 50 });
    });

    describe('constructor', () => {
        it('creates instance with default config', () => {
            const c = new MessageCompressor();
            expect(c).toBeDefined();
        });

        it('creates instance with custom threshold', () => {
            const c = new MessageCompressor({ threshold: 200 });
            expect(c).toBeDefined();
        });
    });

    describe('compress()', () => {
        it('does not compress small payloads', () => {
            const payload = new Uint8Array([1, 2, 3, 4, 5]);
            const result = compressor.compress(payload);

            expect(result.compressed).toBe(false);
            expect(result.data).toBe(payload);
        });

        it('attempts compression for large payloads', () => {
            // Create a compressible payload (repeating pattern)
            const payload = new Uint8Array(200);
            for (let i = 0; i < 200; i++) {
                payload[i] = i % 10;
            }

            const result = compressor.compress(payload);

            expect(result.data).toBeDefined();
            expect(result.data instanceof Uint8Array).toBe(true);
        });

        it('returns original if compressed is larger', () => {
            // Random data doesn't compress well
            const payload = new Uint8Array(100);
            for (let i = 0; i < 100; i++) {
                payload[i] = Math.floor(Math.random() * 256);
            }

            const result = compressor.compress(payload);

            // Should return original if compression didn't help
            if (!result.compressed) {
                expect(result.data).toBe(payload);
            }
        });

        it('throws ValidationError for non-Uint8Array input', () => {
            expect(() => compressor.compress('string')).toThrow('ValidationError');
            expect(() => compressor.compress([1, 2, 3])).toThrow('ValidationError');
        });
    });

    describe('decompress()', () => {
        it('returns original if not compressed', () => {
            const payload = new Uint8Array([1, 2, 3, 4, 5]);
            const result = compressor.decompress(payload, false);

            expect(result).toBe(payload);
        });

        it('round-trips with compression - repetitive data', () => {
            // Highly compressible: repeating pattern
            const original = new Uint8Array(500);
            for (let i = 0; i < 500; i++) {
                original[i] = 65; // All 'A's - very compressible
            }

            const { data: compressed, compressed: wasCompressed } = compressor.compress(original);

            expect(wasCompressed).toBe(true);
            expect(compressed.length).toBeLessThan(original.length);

            // Decompress and verify exact match
            const decompressed = compressor.decompress(compressed, true);
            expect(decompressed.length).toBe(original.length);
            expect(Array.from(decompressed)).toEqual(Array.from(original));
        });

        it('round-trips with compression - mixed pattern', () => {
            // Moderately compressible: repeating sequences
            const original = new Uint8Array(300);
            for (let i = 0; i < 300; i++) {
                original[i] = i % 20; // Repeating 0-19 pattern
            }

            const { data: compressed, compressed: wasCompressed } = compressor.compress(original);

            if (wasCompressed) {
                const decompressed = compressor.decompress(compressed, true);
                expect(decompressed.length).toBe(original.length);
                expect(Array.from(decompressed)).toEqual(Array.from(original));
            }
        });

        it('round-trips with compression - text content', () => {
            // Simulate text message compression
            const text = 'Hello, this is a test message that should be compressed. '.repeat(10);
            const original = new TextEncoder().encode(text);

            const { data: compressed, compressed: wasCompressed } = compressor.compress(original);

            expect(wasCompressed).toBe(true);
            expect(compressed.length).toBeLessThan(original.length);

            const decompressed = compressor.decompress(compressed, true);
            const decodedText = new TextDecoder().decode(decompressed);
            expect(decodedText).toBe(text);
        });

        it('handles edge case - data just above threshold', () => {
            const original = new Uint8Array(51); // Just above threshold of 50
            original.fill(42);

            const { data: compressed, compressed: wasCompressed } = compressor.compress(original);

            if (wasCompressed) {
                const decompressed = compressor.decompress(compressed, true);
                expect(Array.from(decompressed)).toEqual(Array.from(original));
            }
        });

        it('throws ValidationError for non-Uint8Array input when compressed', () => {
            expect(() => compressor.decompress('string', true)).toThrow('ValidationError');
        });
    });

    describe('getCompressionRatio()', () => {
        it('calculates compression ratio', () => {
            const original = new Uint8Array(100);
            const compressed = new Uint8Array(60);

            const ratio = compressor.getCompressionRatio(original, compressed);

            expect(ratio).toBe(40); // 40% reduction
        });

        it('returns 0 for empty original', () => {
            const original = new Uint8Array(0);
            const compressed = new Uint8Array(10);

            const ratio = compressor.getCompressionRatio(original, compressed);

            expect(ratio).toBe(0);
        });
    });

    describe('getStats()', () => {
        it('returns compression statistics', () => {
            const stats = compressor.getStats();

            expect(stats).toHaveProperty('compressionAttempts');
            expect(stats).toHaveProperty('successfulCompressions');
            expect(stats).toHaveProperty('decompressions');
            expect(stats).toHaveProperty('bytesIn');
            expect(stats).toHaveProperty('bytesOut');
            expect(stats).toHaveProperty('averageCompressionRatio');
        });

        it('tracks compression attempts', () => {
            const payload = new Uint8Array(100);
            payload.fill(65);

            compressor.compress(payload);

            const stats = compressor.getStats();
            expect(stats.compressionAttempts).toBe(1);
            expect(stats.bytesIn).toBe(100);
        });

        it('tracks decompression count', () => {
            const payload = new Uint8Array([1, 2, 3]);
            compressor.decompress(payload, false);

            const stats = compressor.getStats();
            expect(stats.decompressions).toBe(0); // Not compressed, so not counted
        });
    });

    describe('resetStats()', () => {
        it('resets all statistics', () => {
            const payload = new Uint8Array(100);
            payload.fill(65);
            compressor.compress(payload);

            compressor.resetStats();

            const stats = compressor.getStats();
            expect(stats.compressionAttempts).toBe(0);
            expect(stats.bytesIn).toBe(0);
        });
    });
});

describe('Module exports', () => {
    describe('compress()', () => {
        it('compresses using default instance', () => {
            const payload = new Uint8Array([1, 2, 3, 4, 5]);
            const result = compress(payload);

            expect(result.compressed).toBe(false);
            expect(result.data).toBe(payload);
        });
    });

    describe('decompress()', () => {
        it('decompresses using default instance', () => {
            const payload = new Uint8Array([1, 2, 3, 4, 5]);
            const result = decompress(payload, false);

            expect(result).toBe(payload);
        });
    });
});

describe('LZ4 Edge Cases', () => {
    let compressor;

    beforeEach(() => {
        compressor = new MessageCompressor({ threshold: 20 });
    });

    it('handles final literals block correctly', () => {
        // Data that ends with unmatched literals
        const original = new Uint8Array(100);
        for (let i = 0; i < 80; i++) {
            original[i] = 65; // Compressible
        }
        for (let i = 80; i < 100; i++) {
            original[i] = i; // Unique values at end
        }

        const { data: compressed, compressed: wasCompressed } = compressor.compress(original);

        if (wasCompressed) {
            const decompressed = compressor.decompress(compressed, true);
            expect(Array.from(decompressed)).toEqual(Array.from(original));
        }
    });

    it('handles long literal runs (>15 bytes)', () => {
        // Create data with long literal sections
        const original = new Uint8Array(200);
        for (let i = 0; i < 200; i++) {
            original[i] = i % 256; // Mostly unique
        }
        // Add some repeating section
        for (let i = 100; i < 150; i++) {
            original[i] = 99;
        }

        const { data: compressed, compressed: wasCompressed } = compressor.compress(original);

        if (wasCompressed) {
            const decompressed = compressor.decompress(compressed, true);
            expect(Array.from(decompressed)).toEqual(Array.from(original));
        }
    });

    it('handles long match runs (>19 bytes)', () => {
        // Create data with very long repeating sections
        const original = new Uint8Array(500);
        original.fill(42); // All same value = maximum compression

        const { data: compressed, compressed: wasCompressed } = compressor.compress(original);

        expect(wasCompressed).toBe(true);

        const decompressed = compressor.decompress(compressed, true);
        expect(decompressed.length).toBe(500);
        expect(Array.from(decompressed)).toEqual(Array.from(original));
    });

    it('handles empty-ish payloads at threshold boundary', () => {
        const compressorLowThreshold = new MessageCompressor({ threshold: 5 });
        const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

        const { data, compressed: wasCompressed } = compressorLowThreshold.compress(original);

        // Whether compressed or not, verify we can decompress
        const result = compressorLowThreshold.decompress(data, wasCompressed);
        expect(Array.from(result)).toEqual(Array.from(original));
    });

    it('rejects invalid compressed data with MeshError', () => {
        // Invalid size header (too large)
        const invalidData = new Uint8Array([0xff, 0xff, 0xff, 0x7f, 1, 2, 3]);

        expect(() => compressor.decompress(invalidData, true)).toThrow('MeshError');
    });

    it('rejects zero offset in compressed data with MeshError', () => {
        // Create data with zero offset (invalid)
        const invalidData = new Uint8Array([
            10, 0, 0, 0,  // Original size: 10
            0x11,         // Token: 1 literal, 1 match
            65,           // Literal byte
            0, 0          // Zero offset (invalid)
        ]);

        expect(() => compressor.decompress(invalidData, true)).toThrow('MeshError');
    });
});
