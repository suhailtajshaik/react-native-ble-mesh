'use strict';

/**
 * @fileoverview Tests for BloomFilter duplicate detection
 */

const BloomFilter = require('../../src/mesh/dedup/BloomFilter');

describe('BloomFilter', () => {
  describe('constructor', () => {
    test('creates filter with given size and hash count', () => {
      const filter = new BloomFilter(1024, 7);
      expect(filter.size).toBe(1024);
      expect(filter.hashCount).toBe(7);
    });

    test('creates filter with custom size and hash count', () => {
      const filter = new BloomFilter(4096, 5);
      expect(filter).toBeDefined();
    });

    test('throws for invalid size', () => {
      expect(() => new BloomFilter(0)).toThrow();
      expect(() => new BloomFilter(-100)).toThrow();
    });

    test('throws for invalid hash count', () => {
      expect(() => new BloomFilter(1024, 0)).toThrow();
      expect(() => new BloomFilter(1024, -1)).toThrow();
    });
  });

  describe('add() and mightContain()', () => {
    let filter;

    beforeEach(() => {
      filter = new BloomFilter(2048, 7);
    });

    test('returns false for items not added', () => {
      expect(filter.mightContain('test')).toBe(false);
      expect(filter.mightContain('hello')).toBe(false);
      expect(filter.mightContain('world')).toBe(false);
    });

    test('returns true for added items', () => {
      filter.add('test');
      filter.add('hello');
      filter.add('world');

      expect(filter.mightContain('test')).toBe(true);
      expect(filter.mightContain('hello')).toBe(true);
      expect(filter.mightContain('world')).toBe(true);
    });

    test('handles string items', () => {
      const items = ['alpha', 'beta', 'gamma', 'delta'];
      items.forEach(item => filter.add(item));
      items.forEach(item => {
        expect(filter.mightContain(item)).toBe(true);
      });
    });

    test('handles Uint8Array items', () => {
      const item1 = new Uint8Array([1, 2, 3, 4]);
      const item2 = new Uint8Array([5, 6, 7, 8]);

      filter.add(item1);
      filter.add(item2);

      expect(filter.mightContain(item1)).toBe(true);
      expect(filter.mightContain(item2)).toBe(true);
      expect(filter.mightContain(new Uint8Array([9, 10, 11, 12]))).toBe(false);
    });

    test('handles UUID-like items', () => {
      const uuids = [
        '550e8400-e29b-41d4-a716-446655440000',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479'
      ];

      uuids.forEach(uuid => filter.add(uuid));
      uuids.forEach(uuid => {
        expect(filter.mightContain(uuid)).toBe(true);
      });

      expect(filter.mightContain('ffffffff-ffff-ffff-ffff-ffffffffffff')).toBe(false);
    });

    test('adding same item multiple times has no effect', () => {
      filter.add('duplicate');
      filter.add('duplicate');
      filter.add('duplicate');

      expect(filter.mightContain('duplicate')).toBe(true);
    });
  });

  describe('clear()', () => {
    test('clears all bits', () => {
      const filter = new BloomFilter(1024, 5);

      filter.add('one');
      filter.add('two');
      filter.add('three');

      expect(filter.mightContain('one')).toBe(true);

      filter.clear();

      expect(filter.mightContain('one')).toBe(false);
      expect(filter.mightContain('two')).toBe(false);
      expect(filter.mightContain('three')).toBe(false);
    });

    test('filter works after clearing', () => {
      const filter = new BloomFilter();

      filter.add('before');
      filter.clear();
      filter.add('after');

      expect(filter.mightContain('before')).toBe(false);
      expect(filter.mightContain('after')).toBe(true);
    });
  });

  describe('false positive rate', () => {
    test('false positive rate is reasonable', () => {
      const filter = new BloomFilter(8192, 7);
      const insertCount = 1000;
      const testCount = 10000;

      // Add items
      for (let i = 0; i < insertCount; i++) {
        filter.add(`item-${i}`);
      }

      // Test items that were never added
      let falsePositives = 0;
      for (let i = 0; i < testCount; i++) {
        if (filter.mightContain(`not-added-${i}`)) {
          falsePositives++;
        }
      }

      const fpRate = falsePositives / testCount;
      // With 8192 bits, 7 hash functions, and 1000 items,
      // expected FP rate is approximately 2-3%
      expect(fpRate).toBeLessThan(0.05); // 5% max acceptable
    });

    test('no false negatives', () => {
      const filter = new BloomFilter(4096, 7);
      const items = [];

      // Add 500 items
      for (let i = 0; i < 500; i++) {
        const item = `item-${i}-${Math.random()}`;
        items.push(item);
        filter.add(item);
      }

      // All added items must be found
      let falseNegatives = 0;
      for (const item of items) {
        if (!filter.mightContain(item)) {
          falseNegatives++;
        }
      }

      expect(falseNegatives).toBe(0);
    });
  });

  describe('hash distribution', () => {
    test('different items produce different bit patterns', () => {
      const filter = new BloomFilter(256, 3);

      filter.add('apple');
      const bits1 = filter.getBitArray ? filter.getBitArray() : null;

      filter.clear();
      filter.add('banana');
      const bits2 = filter.getBitArray ? filter.getBitArray() : null;

      // Skip if getBitArray not implemented
      if (bits1 && bits2) {
        expect(bits1).not.toEqual(bits2);
      }
    });
  });

  describe('edge cases', () => {
    test('handles empty string', () => {
      const filter = new BloomFilter(2048, 7);
      filter.add('');
      expect(filter.mightContain('')).toBe(true);
      expect(filter.mightContain('non-empty')).toBe(false);
    });

    test('handles long strings', () => {
      const filter = new BloomFilter(2048, 7);
      const longString = 'a'.repeat(10000);

      filter.add(longString);
      expect(filter.mightContain(longString)).toBe(true);
    });

    test('handles unicode characters', () => {
      const filter = new BloomFilter(2048, 7);
      const items = ['you hao', 'shi jie', 'emoji', 'marhaba', 'shalom'];

      items.forEach(item => filter.add(item));
      items.forEach(item => {
        expect(filter.mightContain(item)).toBe(true);
      });
    });

    test('handles binary data with null bytes', () => {
      const filter = new BloomFilter(2048, 7);
      const data = new Uint8Array([0, 0, 0, 1, 2, 3, 0, 0]);

      filter.add(data);
      expect(filter.mightContain(data)).toBe(true);
    });
  });

  describe('capacity', () => {
    test('handles large number of items', () => {
      const filter = new BloomFilter(65536, 10);
      const itemCount = 5000;

      // Add many items
      for (let i = 0; i < itemCount; i++) {
        filter.add(`item-${i}`);
      }

      // Verify some are present
      expect(filter.mightContain('item-0')).toBe(true);
      expect(filter.mightContain('item-2500')).toBe(true);
      expect(filter.mightContain(`item-${itemCount - 1}`)).toBe(true);
    });
  });

  describe('getCount()', () => {
    test('returns 0 for empty filter', () => {
      const filter = new BloomFilter(1024, 7);
      expect(filter.getCount()).toBe(0);
    });

    test('increments with each add', () => {
      const filter = new BloomFilter(1024, 7);

      filter.add('item1');
      expect(filter.getCount()).toBe(1);

      filter.add('item2');
      expect(filter.getCount()).toBe(2);

      filter.add('item3');
      expect(filter.getCount()).toBe(3);
    });

    test('resets to zero after clear', () => {
      const filter = new BloomFilter(1024, 7);
      filter.add('item1');
      filter.add('item2');

      expect(filter.getCount()).toBe(2);

      filter.clear();

      expect(filter.getCount()).toBe(0);
    });
  });

  describe('getFillRatio()', () => {
    test('returns 0 for empty filter', () => {
      const filter = new BloomFilter(1024, 7);
      expect(filter.getFillRatio()).toBe(0);
    });

    test('increases as items are added', () => {
      const filter = new BloomFilter(1024, 7);
      const ratios = [];

      for (let i = 0; i < 50; i++) {
        ratios.push(filter.getFillRatio());
        filter.add(`item${i}`);
      }

      // Each ratio should be >= the previous
      for (let i = 1; i < ratios.length; i++) {
        expect(ratios[i]).toBeGreaterThanOrEqual(ratios[i - 1]);
      }
    });

    test('returns value between 0 and 1', () => {
      const filter = new BloomFilter(512, 7);

      for (let i = 0; i < 100; i++) {
        filter.add(`item${i}`);
        const ratio = filter.getFillRatio();
        expect(ratio).toBeGreaterThanOrEqual(0);
        expect(ratio).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('getEstimatedFalsePositiveRate()', () => {
    test('returns 0 for empty filter', () => {
      const filter = new BloomFilter(1024, 7);
      expect(filter.getEstimatedFalsePositiveRate()).toBe(0);
    });

    test('increases as filter fills', () => {
      const filter = new BloomFilter(1024, 7);
      let previousRate = 0;

      for (let i = 0; i < 50; i++) {
        filter.add(`item${i}`);
        const rate = filter.getEstimatedFalsePositiveRate();
        expect(rate).toBeGreaterThanOrEqual(previousRate);
        previousRate = rate;
      }
    });

    test('returns value between 0 and 1', () => {
      const filter = new BloomFilter(512, 7);

      for (let i = 0; i < 100; i++) {
        filter.add(`item${i}`);
        const rate = filter.getEstimatedFalsePositiveRate();
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('message ID deduplication use case', () => {
    test('efficiently detects duplicate message IDs', () => {
      // Simulate real-world message deduplication
      const filter = new BloomFilter(2048, 7);

      // Simulate receiving 200 messages, some duplicates
      const messages = [];
      for (let i = 0; i < 150; i++) {
        messages.push(`msg_${i}`);
      }
      // Add some duplicates
      for (let i = 0; i < 50; i++) {
        messages.push(`msg_${i % 50}`);
      }

      // Shuffle messages
      messages.sort(() => Math.random() - 0.5);

      let duplicatesDetected = 0;
      let newMessages = 0;

      for (const msgId of messages) {
        if (filter.mightContain(msgId)) {
          duplicatesDetected++;
        } else {
          filter.add(msgId);
          newMessages++;
        }
      }

      // Should have detected most duplicates
      expect(newMessages).toBe(150); // All unique messages
      expect(duplicatesDetected).toBeGreaterThanOrEqual(40); // Most duplicates caught

      // All unique message IDs should now be detected
      for (let i = 0; i < 150; i++) {
        expect(filter.mightContain(`msg_${i}`)).toBe(true);
      }
    });

    test('binary message IDs work correctly', () => {
      const filter = new BloomFilter(2048, 7);

      // Create binary message IDs (16 bytes each, like UUIDs)
      const ids = [];
      for (let i = 0; i < 50; i++) {
        const id = new Uint8Array(16);
        for (let j = 0; j < 16; j++) {
          id[j] = (i * 17 + j * 13) & 0xFF;
        }
        ids.push(id);
        filter.add(id);
      }

      // All added IDs should be found
      for (const id of ids) {
        expect(filter.mightContain(id)).toBe(true);
      }

      // A different ID should (probably) not be found
      const differentId = new Uint8Array(16).fill(0xFF);
      expect(filter.mightContain(differentId)).toBe(false);
    });
  });

  describe('filter configuration optimization', () => {
    test('larger filter has lower false positive rate', () => {
      const smallFilter = new BloomFilter(256, 7);
      const largeFilter = new BloomFilter(4096, 7);

      // Add same items to both
      for (let i = 0; i < 50; i++) {
        smallFilter.add(`item${i}`);
        largeFilter.add(`item${i}`);
      }

      expect(largeFilter.getEstimatedFalsePositiveRate())
        .toBeLessThan(smallFilter.getEstimatedFalsePositiveRate());
    });
  });
});
