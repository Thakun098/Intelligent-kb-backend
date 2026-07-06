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
const GeminiVisionService  = require('../services/GeminiVisionService');
const fs                   = require('fs');
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

/**
 * หา caption ที่ timestamp ใกล้ที่สุดกับ chunk
 * ค้นภายใน window ± WINDOW_SEC วินาที
 *
 * @param {number|null} chunkStart  timestamp เริ่มต้นของ chunk (วินาที)
 * @param {Object} frameMap         { timestampSec(string) → caption(string) }
 * @returns {string|null}
 */
function findNearestCaption(chunkStart, frameMap) {
  if (chunkStart == null || Object.keys(frameMap).length === 0) return null;

  const WINDOW_SEC = 30; // ค้นภายใน ±30 วินาทีจาก chunk start
  let nearest  = null;
  let minDist  = Infinity;

  for (const [tsStr, caption] of Object.entries(frameMap)) {
    const ts   = parseFloat(tsStr);
    const dist = Math.abs(ts - chunkStart);
    if (dist < minDist && dist <= WINDOW_SEC) {
      minDist = dist;
      nearest = caption;
    }
  }

  return nearest;
}

function _formatTime(secs) {
  if (secs == null) return '?';
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Worker (concurrency=1 → serial) ─────────────────────────────────────────
videoQueue.process(1, async (job) => {
  const { sourceId, filePath, enableCaptioning: jobEnableCaptioning } = job.data;
  // per-upload override: job.data.enableCaptioning takes precedence over global env
  const enableCaptioning =
    typeof jobEnableCaptioning === 'boolean'
      ? jobEnableCaptioning
      : process.env.ENABLE_FRAME_CAPTIONING !== 'false';
  logger.info(`[VideoWorker] Job ${job.id} started — sourceId=${sourceId}, captioning=${enableCaptioning}`);

  const source = await KnowledgeSource.findByPk(sourceId);
  if (!source) throw new Error(`KnowledgeSource not found: ${sourceId}`);

  const transaction = await sequelize.transaction();
  const capturedFramePaths = []; // track สำหรับ cleanup

  try {
    // ── Step 1: STT (Whisper) ──────────────────────────────────────── 10%
    await job.progress(10);
    const { fullText, segments, language, totalDuration, keyframes } =
      await VideoService.processVideo(filePath);

    if (!fullText?.trim()) throw new Error('Whisper returned empty transcript');

    source.transcript_language    = language;
    source.video_duration_seconds = Math.round(totalDuration);

    // ── Step 2: Frame Captioning (Gemini Vision) ───────────────── 10–30%
    // enableCaptioning = per-upload flag (from frontend toggle)
    // if false → frameMap stays empty → graceful audio-only indexing
    await job.progress(10);
    const frameMap = {}; // { timestampSec → caption }

    if (enableCaptioning && keyframes && keyframes.length > 0) {
      logger.info(`[VideoWorker] Captioning ${keyframes.length} keyframes...`);

      for (let i = 0; i < keyframes.length; i++) {
        const { framePath, timestampSec } = keyframes[i];
        capturedFramePaths.push(framePath);

        // Caption ผ่าน Gemini (return null ถ้า disabled/error → graceful)
        const caption = await GeminiVisionService.captionFrame(framePath);
        if (caption) {
          frameMap[timestampSec] = caption;
          logger.info(`[VideoWorker] Frame @${_formatTime(timestampSec)} captioned`);
        }

        // Cleanup frame ทันทีหลัง caption (ไม่กินพื้นที่ /tmp)
        try { if (fs.existsSync(framePath)) fs.unlinkSync(framePath); } catch (_) {}

        // Add proactive delay to avoid hitting 15 RPM limit quickly (4s per frame)
        if (enableCaptioning) {
          await new Promise(r => setTimeout(r, 4000));
        }

        // Progress: 10% → 30% ระหว่าง captioning
        await job.progress(10 + Math.floor((i / keyframes.length) * 20));
      }

      const captionCount = Object.keys(frameMap).length;
      logger.info(`[VideoWorker] Captioning done — ${captionCount}/${keyframes.length} frames captioned`);
    }

    // ── Step 3: Thai NLP ───────────────────────────────────────────── 35%
    await job.progress(35);
    const tokenized = await ThaiNLPService.tokenize(fullText);

    // ── Step 4: Chunk ─────────────────────────────────────────────── 40%
    await job.progress(40);
    const chunks = ChunkingService.chunkText(tokenized);
    logger.info(`[VideoWorker] ${chunks.length} chunks created`);

    // ── Step 5: Embed + Enrich + Insert ──────────────────────────── 40–95%
    for (let i = 0; i < chunks.length; i++) {
      await job.progress(40 + Math.floor((i / chunks.length) * 55));

      const { start, end } = findTimestampForChunk(chunks[i], segments);

      // หา caption ที่ใกล้ที่สุดกับ timestamp ของ chunk นี้
      const nearestCaption = findNearestCaption(start, frameMap);

      // รวม audio + visual เป็น combined text เสมอ เพื่อให้ format ตรงกัน
      const enrichedText = `[AUDIO] ${chunks[i]}\n[VISUAL] ${nearestCaption ? nearestCaption : '(No visual data available)'}`;

      // Embed combined text
      const vector = await EmbeddingService.embed(enrichedText);

      await DocumentChunk.create({
        source_id:        sourceId,
        page_number:      null,
        raw_text_content: enrichedText,      // ← combined text (เดิมคือ chunks[i])
        frame_caption:    nearestCaption,    // ← เก็บ caption แยก (field ใหม่)
        vector_embedding: vector,
        timestamp_start:  start,
        timestamp_end:    end
      }, { transaction });

      const captionTag = nearestCaption ? ' +caption' : '';
      logger.info(
        `[VideoWorker] Chunk ${i+1}/${chunks.length}` +
        (start != null ? ` @ ${_formatTime(start)}–${_formatTime(end)}` : '') +
        captionTag
      );
    }

    // ── Step 6: Update status ─────────────────────────────────────── 100%
    source.status = 'ACTIVE';
    await source.save({ transaction });
    await transaction.commit();

    await job.progress(100);
    const captionedCount = Object.keys(frameMap).length;
    logger.info(
      `[VideoWorker] Done — sourceId=${sourceId}, ` +
      `chunks=${chunks.length}, captioned_frames=${captionedCount}`
    );
    return { status: 'COMPLETED', chunks: chunks.length, captioned_frames: captionedCount };

  } catch (error) {
    await transaction.rollback();
    logger.error(`[VideoWorker] Failed sourceId=${sourceId}: ${error.message}`);

    // Cleanup frame files ถ้า error กลางทาง
    for (const fp of capturedFramePaths) {
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch (_) {}
    }

    try {
      source.status = 'PENDING_PROCESSING';
      await source.save();
    } catch (_) {}
    throw error;
  }
});

logger.info('[VideoWorker] Registered (concurrency=1)');
