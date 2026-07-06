/**
 * GeminiVisionService.js
 *
 * ส่ง keyframe image ไปยัง Gemini 2.5 Flash Lite Vision
 * และรับ caption text กลับมา
 *
 * Features:
 *   - Retry on 429 (rate limit) — exponential backoff
 *   - Graceful degradation: ถ้า API ล้มเหลว → return null (ไม่ throw)
 *   - Feature toggle: ENABLE_FRAME_CAPTIONING=false → return null ทันที
 *
 * Free tier limits (Gemini 2.5 Flash Lite):
 *   ~15–30 RPM, ~1,500 RPD per project
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs     = require('fs');
const path   = require('path');
const logger = require('../utils/logger');

const ENABLED      = process.env.ENABLE_FRAME_CAPTIONING !== 'false';
const MODEL_NAME   = process.env.GEMINI_VISION_MODEL   || 'gemini-2.5-flash-lite';
const DELAY_MS     = parseInt(process.env.GEMINI_VISION_DELAY_MS    || '2500', 10);
const MAX_RETRIES  = parseInt(process.env.GEMINI_VISION_MAX_RETRIES || '3',    10);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Prompt ที่ใช้ให้ Gemini อธิบาย frame
const CAPTION_PROMPT = `คุณเป็น AI ช่วยวิเคราะห์ภาพจากวิดีโอสำหรับระบบ Knowledge Base

อธิบายเนื้อหาในภาพนี้อย่างละเอียดและครบถ้วน โดยระบุสิ่งต่อไปนี้ที่พบ:
- **ข้อความ**: ข้อความบนสไลด์, whiteboard, หน้าจอ, ป้าย (ระบุทุกตัว)
- **กราฟ/แผนภูมิ**: ประเภทกราฟ, หัวเรื่อง, แกน X/Y, ค่าที่โดดเด่น, แนวโน้ม
- **Diagram/Architecture**: component แต่ละตัว, ความสัมพันธ์, ทิศทาง flow
- **Code**: ภาษาโปรแกรม, function หลัก, logic สำคัญ (ถ้าอ่านได้)
- **สูตร/ตัวเลข**: สมการ, ข้อมูลสถิติ, ตาราง
- **Visual emphasis**: สิ่งที่ถูก highlight, ขีดเส้นใต้, กรอบ, สีพิเศษ

ตอบเป็นภาษาไทยหรืออังกฤษตามภาษาหลักในภาพ
กระชับ ได้ใจความ ไม่เกิน 300 คำ
ถ้าภาพเป็นฉากว่างเปล่า หน้าจอดำ หรือไม่มีเนื้อหาสำคัญ ให้ตอบว่า "NO_CONTENT"`;

class GeminiVisionService {
  constructor() {
    if (!ENABLED) {
      logger.info('[GeminiVision] Frame captioning DISABLED (ENABLE_FRAME_CAPTIONING=false)');
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      logger.warn('[GeminiVision] GEMINI_API_KEY not set — captioning will be skipped');
      return;
    }

    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: MODEL_NAME });
    logger.info(`[GeminiVision] Ready — model: ${MODEL_NAME}`);
  }

  /**
   * Caption a single frame image
   *
   * @param {string} framePath  absolute path ของ .jpg frame
   * @returns {Promise<string|null>}  caption text หรือ null ถ้า fail/disabled
   */
  async captionFrame(framePath) {
    // Guard: disabled หรือไม่มี key → ข้าม
    if (!ENABLED || !this.model) return null;

    // Guard: ไฟล์ไม่มีอยู่
    if (!fs.existsSync(framePath)) {
      logger.warn(`[GeminiVision] Frame file not found: ${framePath}`);
      return null;
    }

    return this._captionWithRetry(framePath, 0);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE
  // ──────────────────────────────────────────────────────────────────────────

  async _captionWithRetry(framePath, attempt) {
    try {
      // อ่านภาพเป็น base64
      const imageData   = fs.readFileSync(framePath);
      const base64Image = imageData.toString('base64');
      const mimeType    = 'image/jpeg';

      const result = await this.model.generateContent([
        CAPTION_PROMPT,
        {
          inlineData: {
            mimeType,
            data: base64Image
          }
        }
      ]);

      const caption = result.response.text().trim();

      // กรอง NO_CONTENT ออก
      if (caption === 'NO_CONTENT' || caption.length < 10) {
        logger.info(`[GeminiVision] Frame ${path.basename(framePath)} → no meaningful content`);
        return null;
      }

      logger.info(`[GeminiVision] Captioned ${path.basename(framePath)} (${caption.length} chars)`);
      return caption;

    } catch (error) {
      const status = error.status || error.code;

      // 429 Rate limit → exponential backoff
      if (status === 429) {
        const waitMs = DELAY_MS * Math.pow(2, attempt); // 2.5s → 5s → 10s
        logger.warn(`[GeminiVision] 429 rate limit — waiting ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);

        if (attempt < MAX_RETRIES - 1) {
          await sleep(waitMs);
          return this._captionWithRetry(framePath, attempt + 1);
        }
      }

      // Quota exhausted หรือ error อื่น → graceful degradation
      logger.error(`[GeminiVision] Failed to caption ${path.basename(framePath)}: ${error.message}`);
      return null; // ← ไม่ throw ให้ pipeline เดินหน้าต่อ
    }
  }
}

module.exports = new GeminiVisionService();
