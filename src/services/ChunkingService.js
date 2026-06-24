class ChunkingService {
  /**
   * Chunks plain text content into overlapping text blocks
   * @param {string} text Full raw text extracted from the document
   * @param {number} size Target character size for each chunk (default: 800)
   * @param {number} overlap Characters overlapped between chunks (default: 150)
   * @returns {string[]} Array of chunk text strings
   */
  chunkText(text, size = 800, overlap = 150) {
    if (!text || typeof text !== 'string') return [];
    
    // Normalize spaces and line endings
    const cleanedText = text.replace(/\s+/g, ' ').trim();
    if (cleanedText.length <= size) {
      return [cleanedText];
    }

    const chunks = [];
    let startIndex = 0;

    while (startIndex < cleanedText.length) {
      let endIndex = startIndex + size;
      
      // If we are not at the end of the text, try to find a natural word boundary
      // to avoid splitting words in the middle. We search backwards for a space.
      if (endIndex < cleanedText.length) {
        const lastSpace = cleanedText.lastIndexOf(' ', endIndex);
        // Ensure the boundary is reasonably close to our target size (within 50 characters)
        if (lastSpace > startIndex && (endIndex - lastSpace) < 50) {
          endIndex = lastSpace;
        }
      }

      const chunk = cleanedText.slice(startIndex, endIndex).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      // Slide start index by chunk size minus overlap
      startIndex = endIndex - overlap;
      if (startIndex < 0 || (endIndex >= cleanedText.length)) {
        break;
      }
    }

    return chunks;
  }
}

module.exports = new ChunkingService();
