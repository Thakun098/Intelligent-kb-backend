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
   * Heading levels:
   *   ##  → Document-level heading (e.g. "## ชื่อ Doc หลัก").
   *         Tracked separately and NEVER flushed as its own chunk.
   *         Re-injected into every chunk until a new "===" or a new "##" appears.
   *   ### → Section-level heading (e.g. "### Title ย่อย").
   *         Forces a flush of whatever chunk was being built BEFORE this
   *         heading is processed, so content from the previous section can
   *         never bleed into the next section's heading (and vice versa).
   *
   * Boundaries:
   *   ===  → Hard document boundary. Flushes the current chunk WITHOUT
   *          carrying overlap forward, and resets both doc-level and
   *          section-level headings.
   *   ---  → Soft section boundary. Flushes the current chunk and DOES
   *          carry overlap forward (still within the same document).
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

    // ── Step 2: Split into paragraphs ──
    // Paragraphs are separated by \n\n as usual, but structural markers
    // (===, ---, ##/### headings) are also treated as hard split points
    // even when they're only separated by a single \n. This matters because
    // authors commonly write:
    //   ## Title
    //   ---
    //   ### Sub Title
    //   detail...
    // with single newlines between the marker lines, which would otherwise
    // collapse into one giant paragraph and bypass all boundary handling.
    const MARKER_RE = /^(={3,}|-{3,}|#{1,3}\s.*)$/;
    const rawParagraphs = normalized.split(/\n\n+/);
    const paragraphs = [];
    for (const block of rawParagraphs) {
      const lines = block.split('\n');
      let buf = [];
      const flushBuf = () => {
        if (buf.length) {
          const joined = buf.join('\n').trim();
          if (joined) paragraphs.push(joined);
          buf = [];
        }
      };
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (MARKER_RE.test(trimmedLine)) {
          flushBuf();          // close out whatever text was accumulating
          paragraphs.push(trimmedLine); // marker becomes its own paragraph
        } else {
          buf.push(line);
        }
      }
      flushBuf();
    }
    const cleanParagraphs = paragraphs
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const chunks = [];
    let currentChunk = '';
    let docHeading = '';   // tracks current "## " document-level heading
    let secHeading = '';   // tracks current "### " section-level heading (rarely buffered, mostly transient)

    // Helper: the heading block that should prefix any new chunk right now
    const headingBlock = () => {
      const parts = [];
      if (docHeading) parts.push(docHeading);
      if (secHeading) parts.push(secHeading);
      return parts.join('\n');
    };

    for (const para of cleanParagraphs) {

      // ── Hard boundary: === → flush clean, no overlap carry, reset all headings ──
      if (/^={3,}$/.test(para)) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        docHeading = '';
        secHeading = '';
        continue;
      }

      // ── Soft boundary: --- → flush but carry overlap forward ──
      if (/^-{3,}$/.test(para)) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          const overlapText = currentChunk.slice(-overlap).trim();
          currentChunk = overlapText; // carry overlap within the same document
        }
        continue;
      }

      // ── ## = document-level heading: never becomes its own chunk ──
      if (/^##\s/.test(para) && !/^###\s/.test(para)) {
        // A new document-level heading implicitly starts a new top-level
        // unit — flush whatever was pending under the OLD doc heading first.
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        docHeading = para;
        secHeading = '';
        continue; // do not inject into currentChunk by itself
      }

      // ── ### = section-level heading: force-flush previous section first ──
      if (/^###\s/.test(para)) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        secHeading = para;
        currentChunk = headingBlock(); // inject doc heading + this section heading together
        continue;
      }

      // ── Regular paragraph: ensure the chunk we're building has its heading context ──
      if (!currentChunk) {
        const hb = headingBlock();
        if (hb) currentChunk = hb;
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

          // Re-inject heading context so the NEW chunk still knows where it lives
          const hb = headingBlock();
          const headingPrefix = hb ? hb + '\n\n' : '';

          const nextCandidate = overlapText
            ? overlapText + '\n\n' + headingPrefix + para
            : headingPrefix + para;

          if (nextCandidate.length <= size) {
            currentChunk = nextCandidate;
          } else {
            // Even with just overlap + heading + paragraph it overflows → fall back.
            // Prefix the heading onto the paragraph BEFORE char-splitting so that
            // every resulting sub-chunk (including pure-overflow pieces) still
            // carries doc/section context instead of being orphaned.
            const paraWithHeading = hb ? hb + '\n\n' + para : para;
            const subChunks = this._splitByChars(paraWithHeading, size, overlap);
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
