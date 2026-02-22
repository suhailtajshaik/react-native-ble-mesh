'use strict';

const FileManager = require('../../../src/service/file/FileManager');
const FileChunker = require('../../../src/service/file/FileChunker');
const FileAssembler = require('../../../src/service/file/FileAssembler');
const { FileMessage, FILE_MESSAGE_TYPE, FILE_TRANSFER_STATE } = require('../../../src/service/file/FileMessage');

describe('FileChunker', () => {
  let chunker;

  beforeEach(() => {
    chunker = new FileChunker({ chunkSize: 10, maxFileSize: 1000 });
  });

  it('chunks data into correct sizes', () => {
    const data = new Uint8Array(25);
    const chunks = chunker.chunk(data, 'test-1');
    expect(chunks).toHaveLength(3);
    expect(chunks[0].data.length).toBe(10);
    expect(chunks[1].data.length).toBe(10);
    expect(chunks[2].data.length).toBe(5);
  });

  it('handles exact chunk size', () => {
    const data = new Uint8Array(20);
    const chunks = chunker.chunk(data, 'test-2');
    expect(chunks).toHaveLength(2);
  });

  it('handles empty data', () => {
    const chunks = chunker.chunk(new Uint8Array(0), 'test-3');
    expect(chunks).toHaveLength(0);
  });

  it('rejects non-Uint8Array', () => {
    expect(() => chunker.chunk('string', 'test')).toThrow('Uint8Array');
  });

  it('rejects oversized files', () => {
    expect(() => chunker.chunk(new Uint8Array(1001), 'test')).toThrow('exceeds max');
  });

  it('calculates chunk count', () => {
    expect(chunker.getChunkCount(25)).toBe(3);
    expect(chunker.getChunkCount(10)).toBe(1);
    expect(chunker.getChunkCount(0)).toBe(0);
  });
});

describe('FileAssembler', () => {
  it('assembles chunks in order', () => {
    const assembler = new FileAssembler('test-1', 3, 25);
    assembler.addChunk(0, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    assembler.addChunk(1, new Uint8Array([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]));
    assembler.addChunk(2, new Uint8Array([21, 22, 23, 24, 25]));

    expect(assembler.isComplete()).toBe(true);
    expect(assembler.progress).toBe(100);

    const result = assembler.assemble();
    expect(result.length).toBe(25);
    expect(result[0]).toBe(1);
    expect(result[24]).toBe(25);
  });

  it('handles out-of-order chunks', () => {
    const assembler = new FileAssembler('test-2', 2, 10);
    assembler.addChunk(1, new Uint8Array([6, 7, 8, 9, 10]));
    assembler.addChunk(0, new Uint8Array([1, 2, 3, 4, 5]));

    expect(assembler.isComplete()).toBe(true);
    const result = assembler.assemble();
    expect(result[0]).toBe(1);
    expect(result[9]).toBe(10);
  });

  it('rejects duplicate chunks', () => {
    const assembler = new FileAssembler('test-3', 2, 10);
    expect(assembler.addChunk(0, new Uint8Array(5))).toBe(true);
    expect(assembler.addChunk(0, new Uint8Array(5))).toBe(false);
  });

  it('rejects out-of-range chunks', () => {
    const assembler = new FileAssembler('test-4', 2, 10);
    expect(assembler.addChunk(-1, new Uint8Array(5))).toBe(false);
    expect(assembler.addChunk(5, new Uint8Array(5))).toBe(false);
  });

  it('throws if assembled before complete', () => {
    const assembler = new FileAssembler('test-5', 2, 10);
    assembler.addChunk(0, new Uint8Array(5));
    expect(() => assembler.assemble()).toThrow('Cannot assemble');
  });

  it('tracks progress', () => {
    const assembler = new FileAssembler('test-6', 4, 40);
    expect(assembler.progress).toBe(0);
    assembler.addChunk(0, new Uint8Array(10));
    expect(assembler.progress).toBe(25);
    assembler.addChunk(1, new Uint8Array(10));
    expect(assembler.progress).toBe(50);
  });

  it('clears chunks', () => {
    const assembler = new FileAssembler('test-7', 2, 10);
    assembler.addChunk(0, new Uint8Array(5));
    assembler.clear();
    expect(assembler.receivedChunks).toBe(0);
  });
});

describe('FileMessage', () => {
  it('creates with required fields', () => {
    const msg = new FileMessage({
      id: 'ft-1',
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      totalChunks: 4,
    });
    expect(msg.name).toBe('photo.jpg');
    expect(msg.progress).toBe(0);
  });

  it('serializes to offer', () => {
    const msg = new FileMessage({
      id: 'ft-1', name: 'test.txt', size: 100, totalChunks: 1,
    });
    const offer = msg.toOffer();
    expect(offer.type).toBe(FILE_MESSAGE_TYPE.OFFER);
    expect(offer.name).toBe('test.txt');
  });

  it('creates from offer', () => {
    const offer = { id: 'ft-1', name: 'test.txt', mimeType: 'text/plain', size: 100, totalChunks: 1, chunkSize: 4096 };
    const msg = FileMessage.fromOffer(offer, 'sender-1');
    expect(msg.senderId).toBe('sender-1');
    expect(msg.name).toBe('test.txt');
  });
});

describe('FileManager', () => {
  let manager;

  beforeEach(() => {
    manager = new FileManager({ chunkSize: 10, maxFileSize: 1000, transferTimeoutMs: 5000 });
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('prepareSend()', () => {
    it('prepares a file transfer', () => {
      const result = manager.prepareSend('peer-1', {
        data: new Uint8Array(25),
        name: 'test.bin',
        mimeType: 'application/octet-stream',
      });
      expect(result.id).toBeTruthy();
      expect(result.offer.type).toBe(FILE_MESSAGE_TYPE.OFFER);
      expect(result.chunks).toHaveLength(3);
      expect(result.totalChunks).toBe(3);
    });
  });

  describe('markChunkSent()', () => {
    it('emits progress events', () => {
      const handler = jest.fn();
      manager.on('sendProgress', handler);

      const transfer = manager.prepareSend('peer-1', {
        data: new Uint8Array(20),
        name: 'test.bin',
      });

      manager.markChunkSent(transfer.id, 0);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ percent: 50 })
      );

      manager.markChunkSent(transfer.id, 1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ percent: 100 })
      );
    });

    it('emits sendComplete on final chunk', () => {
      const handler = jest.fn();
      manager.on('sendComplete', handler);

      const transfer = manager.prepareSend('peer-1', {
        data: new Uint8Array(10),
        name: 'small.bin',
      });

      manager.markChunkSent(transfer.id, 0);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ transferId: transfer.id })
      );
    });
  });

  describe('receive flow', () => {
    it('handles offer + chunks → fileReceived', () => {
      const receivedHandler = jest.fn();
      const progressHandler = jest.fn();
      manager.on('fileReceived', receivedHandler);
      manager.on('receiveProgress', progressHandler);

      const offer = {
        type: FILE_MESSAGE_TYPE.OFFER,
        id: 'ft-test',
        name: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 20,
        totalChunks: 2,
        chunkSize: 10,
      };

      manager.handleOffer(offer, 'sender-1');

      manager.handleChunk('ft-test', 0, new Uint8Array(10).fill(1));
      expect(progressHandler).toHaveBeenCalledWith(
        expect.objectContaining({ percent: 50 })
      );

      manager.handleChunk('ft-test', 1, new Uint8Array(10).fill(2));
      expect(receivedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'sender-1',
          file: expect.objectContaining({
            name: 'photo.jpg',
            mimeType: 'image/jpeg',
            size: 20,
          }),
        })
      );
    });

    it('ignores duplicate chunks', () => {
      const handler = jest.fn();
      manager.on('receiveProgress', handler);

      manager.handleOffer({ id: 'ft-dup', name: 'test', size: 10, totalChunks: 1, chunkSize: 10 }, 'sender');
      manager.handleChunk('ft-dup', 0, new Uint8Array(10));
      manager.handleChunk('ft-dup', 0, new Uint8Array(10)); // duplicate

      // Progress should only fire once
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelTransfer()', () => {
    it('cancels outgoing transfer', () => {
      const handler = jest.fn();
      manager.on('transferCancelled', handler);

      const transfer = manager.prepareSend('peer-1', {
        data: new Uint8Array(20), name: 'test.bin',
      });
      manager.cancelTransfer(transfer.id);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'outgoing' })
      );
    });

    it('cancels incoming transfer', () => {
      const handler = jest.fn();
      manager.on('transferCancelled', handler);

      manager.handleOffer({ id: 'ft-cancel', name: 'test', size: 10, totalChunks: 1, chunkSize: 10 }, 'sender');
      manager.cancelTransfer('ft-cancel');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'incoming' })
      );
    });
  });

  describe('getActiveTransfers()', () => {
    it('lists active transfers', () => {
      manager.prepareSend('peer-1', { data: new Uint8Array(20), name: 'out.bin' });
      manager.handleOffer({ id: 'ft-in', name: 'in.bin', size: 10, totalChunks: 1, chunkSize: 10 }, 'sender');

      const active = manager.getActiveTransfers();
      expect(active.outgoing).toHaveLength(1);
      expect(active.incoming).toHaveLength(1);
    });
  });
});
