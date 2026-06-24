const ChunkingService = require('../../../src/services/ChunkingService');

describe('ChunkingService Unit Tests', () => {
  test('Splits large text into smaller chunks successfully', () => {
    const rawText = 'This is a very long string that should be chunked properly by the application logic. ' +
      'We will test if the chunk character length boundary is respected and if the overlap characters are preserved correctly.';
    
    // Set chunk size to 30 and overlap to 5 for testing
    const chunks = ChunkingService.chunkText(rawText, 30, 5);
    
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach(chunk => {
      expect(chunk.length).toBeLessThanOrEqual(30);
    });
  });

  test('Preserves text structure when content is smaller than size', () => {
    const rawText = 'Short sentence.';
    const chunks = ChunkingService.chunkText(rawText, 100, 15);
    
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe('Short sentence.');
  });
});
