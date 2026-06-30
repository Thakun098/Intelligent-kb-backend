/**
 * videoWorker.js
 *
 * Pipeline:
 *   1. VideoService.processVideo()   → fullText + Whisper segments
 *   2. ThaiNLPService.tokenize()     → tokenized text
 *   3. ChunkingService.chunkText()   → text chunks
 *   4. map timestamp → chunks (ใช้ text overlap matching)
 *   5. EmbeddingService.embed()      → vector per chunk
 *   6. INSERT document_chunks (พร้อม timestamp_start/end)
 *   7. UPDATE knowledge_sources → ACTIVE
 *
 * concurrency = 1 → serial processing (ป้องกัน Groq rate limit)
 */
const videoQueue       = require('../queues/videoQueue');
const VideoService     = require('../services/VideoService');
const ThaiNLPService   = require('../services/ThaiNLPService');
const ChunkingService  = require('../services/ChunkingService');
const EmbeddingService = require('../services/EmbeddingService');
const { KnowledgeSource, DocumentChunk, sequelize } = require('../models');
const logger           = require('../utils/logger');

// ─── Helper: หา timestamp สำหรับ chunk จาก Whisper segments ────────────────
function findTimestampForChunk(chunkText, segments) {
  if (!segments || segments.length === 0) return { start: null, end: null };

  const words = chunkText.toLowerCase().split(/\s+/).slice(0, 10);
  const matched = segments.filter((seg) => {
    const segText = (seg.text || '').toLowerCase();
    return words.some((w) => w.length > 2 && segText.includes(w));
  });

  if (matched.length === 0) return { start: null, end: null };
  return {
    start: matched[0].start,
    end:   matched[matched.length - 1].end
  };
}

function _formatTime(secs) {
  if (secs == null) return '?';
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Worker (concurrency=1 → serial) ─────────────────────────────────────────
videoQueue.process(1, async (job) => {
  const { sourceId, filePath } = job.data;
  logger.info(`[VideoWorker] Job ${job.id} started — sourceId=${sourceId}`);

  const source = await KnowledgeSource.findByPk(sourceId);
  if (!source) throw new Error(`KnowledgeSource not found: ${sourceId}`);

  const transaction = await sequelize.transaction();

  try {
    // 1. STT
    await job.progress(10);
    const { fullText, segments, language, totalDuration } =
      await VideoService.processVideo(filePath);

    if (!fullText?.trim()) throw new Error('Whisper returned empty transcript');

    source.transcript_language    = language;
    source.video_duration_seconds = Math.round(totalDuration);

    // 2. Thai NLP
    await job.progress(25);
    const tokenized = await ThaiNLPService.tokenize(fullText);

    // 3. Chunk
    await job.progress(35);
    const chunks = ChunkingService.chunkText(tokenized);
    logger.info(`[VideoWorker] ${chunks.length} chunks created`);

    // 4. Embed + Insert
    for (let i = 0; i < chunks.length; i++) {
      await job.progress(35 + Math.floor((i / chunks.length) * 55));
      const vector         = await EmbeddingService.embed(chunks[i]);
      const { start, end } = findTimestampForChunk(chunks[i], segments);

      await DocumentChunk.create({
        source_id:        sourceId,
        page_number:      null,
        raw_text_content: chunks[i],
        vector_embedding: vector,
        timestamp_start:  start,
        timestamp_end:    end
      }, { transaction });

      logger.info(
        `[VideoWorker] Chunk ${i+1}/${chunks.length}` +
        (start != null ? ` @ ${_formatTime(start)}–${_formatTime(end)}` : '')
      );
    }

    // 5. Update status
    source.status = 'ACTIVE';
    await source.save({ transaction });
    await transaction.commit();

    await job.progress(100);
    logger.info(`[VideoWorker] Done — sourceId=${sourceId}, chunks=${chunks.length}`);
    return { status: 'COMPLETED', chunks: chunks.length };

  } catch (error) {
    await transaction.rollback();
    logger.error(`[VideoWorker] Failed sourceId=${sourceId}: ${error.message}`);

    // ตั้ง PENDING_PROCESSING ไว้ให้ Bull retry (ไม่ DEPRECATED ทันที)
    try { 
      source.status = 'PENDING_PROCESSING'; 
      await source.save(); 
    } catch (_) {}
    throw error;
  }
});

logger.info('[VideoWorker] Registered (concurrency=1)');
