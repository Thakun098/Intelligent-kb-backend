// bge-m3 context window: 8192 tokens ≈ 3000+ Thai chars safely
// Defaults tuned for bge-m3; override via CHUNK_SIZE / CHUNK_OVERLAP env vars
const DEFAULT_CHUNK_SIZE    = parseInt(process.env.CHUNK_SIZE    || '1200', 10);
const DEFAULT_CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || '200',  10);

class ChunkingService {
  /**
   * Chunks plain text into overlapping blocks using a paragraph-aware strategy.
   *
   * Strategy:
   *   1. Normalize line endings and collapse excessive blank lines,
   *      but PRESERVE paragraph breaks (\n\n) as semantic boundaries.
   *   2. Split text into paragraphs by \n\n.
   *   3. Greedily accumulate paragraphs into a chunk until `size` is reached.
   *   4. When a chunk is full, carry the last `overlap` characters into the
   *      next chunk as context (overlap window).
   *   5. If a single paragraph exceeds `size` by itself, fall back to
   *      character-level splitting with word-boundary detection.
   *
   * Model context limits (for reference):
   *   bge-m3          → 8192 tokens ≈ safe up to ~2000 chars Thai text
   *   nomic-embed-text → 512 tokens ≈ safe up to ~600 chars Thai text
   *
   * @param {string} text    Full raw text extracted from the document
   * @param {number} size    Target character size per chunk (default: CHUNK_SIZE env or 1200)
   * @param {number} overlap Characters of context shared between chunks (default: CHUNK_OVERLAP env or 200)
   * @returns {string[]} Array of chunk text strings
   */
  chunkText(text, size = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP) {
    if (!text || typeof text !== 'string') return [];

    // ── Step 1: Normalize whitespace while preserving paragraph structure ──
    const normalized = text
      .replace(/\r\n/g, '\n')       // Normalize Windows CRLF → LF
      .replace(/\r/g, '\n')         // Normalize old Mac CR → LF
      .replace(/\n{3,}/g, '\n\n')   // Collapse 3+ blank lines → double newline
      .replace(/[ \t]+/g, ' ')      // Collapse horizontal whitespace only (NOT newlines)
      .trim();

    if (normalized.length <= size) {
      return [normalized];
    }

    // ── Step 2: Split into paragraphs by double newline ──
    const paragraphs = normalized
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const chunks = [];
    let currentChunk = '';
    let currentHeading = ''; // track ## heading ปัจจุบัน

    for (const para of paragraphs) {

      // ── Hard boundary: === → flush สะอาด ไม่ carry overlap ──
      if (para === '===') {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';      // reset สะอาด ข้าม document boundary
        }
        currentHeading = '';      // reset heading ด้วย
        continue;
      }

      // ── Soft boundary: --- → flush แต่ carry overlap ──
      if (para === '---') {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          const overlapText = currentChunk.slice(-overlap).trim();
          currentChunk = overlapText; // carry overlap ข้าม section ได้
        }
        continue;
      }

      // ── Heading capture: ## หรือ ### → เก็บไว้ inject ──
      if (/^#{1,3}\s/.test(para)) {
        currentHeading = para;
        // inject heading เข้า chunk ถ้า currentChunk ว่างอยู่
        if (!currentChunk) {
          currentChunk = currentHeading;
          currentHeading = '';
        }
        continue;
      }

      // ── inject heading เข้า chunk ใหม่ที่เพิ่งเริ่ม ──
      if (currentHeading && !currentChunk) {
        currentChunk = currentHeading;
        currentHeading = '';
      }

      const separator = currentChunk ? '\n\n' : '';
      const candidate = currentChunk + separator + para;

      if (candidate.length <= size) {
        // Paragraph fits → keep accumulating
        currentChunk = candidate;
      } else {
        // Paragraph does NOT fit into current chunk
        if (currentChunk) {
          // Save the completed chunk
          chunks.push(currentChunk.trim());

          // Carry the last `overlap` chars of the current chunk as context
          const overlapText = currentChunk.slice(-overlap).trim();

          // ── inject heading ถ้ามี ไว้หัว chunk ใหม่ ──
          const headingPrefix = currentHeading
            ? currentHeading + '\n\n'
            : '';
          currentHeading = '';

          const nextCandidate = overlapText
            ? overlapText + '\n\n' + headingPrefix + para
            : headingPrefix + para;

          if (nextCandidate.length <= size) {
            currentChunk = nextCandidate;
          } else {
            // Even with just overlap + paragraph it overflows → fall back
            const subChunks = this._splitByChars(para, size, overlap);
            chunks.push(...subChunks.slice(0, -1));
            currentChunk = subChunks[subChunks.length - 1] || '';
          }
        } else {
          // currentChunk is empty but paragraph alone already exceeds size
          const subChunks = this._splitByChars(para, size, overlap);
          chunks.push(...subChunks.slice(0, -1));
          currentChunk = subChunks[subChunks.length - 1] || '';
        }
      }
    }

    // Flush whatever remains in the buffer
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Fallback: character-level splitter with word-boundary snapping.
   * Used when a single paragraph is longer than `size`.
   *
   * @param {string} text
   * @param {number} size
   * @param {number} overlap
   * @returns {string[]}
   */
  _splitByChars(text, size, overlap) {
    const chunks = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      let endIndex = startIndex + size;

      if (endIndex < text.length) {
        // Prefer to break at a space near the target boundary (within 50 chars back)
        const lastSpace = text.lastIndexOf(' ', endIndex);
        if (lastSpace > startIndex && (endIndex - lastSpace) < 50) {
          endIndex = lastSpace;
        }
      }

      const chunk = text.slice(startIndex, endIndex).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      startIndex = endIndex - overlap;
      if (startIndex <= 0 || endIndex >= text.length) break;
    }

    return chunks;
  }
}

module.exports = new ChunkingService();
