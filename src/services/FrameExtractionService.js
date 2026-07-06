/**
 * FrameExtractionService.js
 *
 * ดึง keyframes จากวิดีโอโดยใช้ ffmpeg scene detection
 *
 * Strategy:
 *   1. รัน ffmpeg scene detection (select=gt(scene,THRESHOLD))
 *   2. Filter frames ที่ห่างกัน < MIN_INTERVAL_SEC ออก
 *   3. Fallback: ถ้าได้ < 3 frames → interval-based sampling ทุก 30 วินาที
 *   4. Cap ที่ MAX_PER_VIDEO frames
 *   5. Export เป็น .jpg ใน OS tmpdir
 *
 * Return:
 *   [{ framePath: string, timestampSec: number }]
 *
 * Caller ต้องลบ framePath หลังใช้งาน (tmp cleanup)
 */
const ffmpeg     = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const path       = require('path');
const os         = require('os');
const fs         = require('fs');
const logger     = require('../utils/logger');

ffmpeg.setFfmpegPath(ffmpegPath);

const SCENE_THRESHOLD   = parseFloat(process.env.KEYFRAME_SCENE_THRESHOLD   || '0.4');
const MIN_INTERVAL_SEC  = parseFloat(process.env.KEYFRAME_MIN_INTERVAL_SEC  || '15');
const MAX_PER_VIDEO     = parseInt(process.env.KEYFRAME_MAX_PER_VIDEO       || '100', 10);
const OUTPUT_QUALITY    = parseInt(process.env.KEYFRAME_OUTPUT_QUALITY      || '2',   10);

class FrameExtractionService {

  /**
   * ดึง keyframes จาก videoPath
   * @param {string} videoPath  path ของวิดีโอ
   * @returns {Promise<Array<{framePath: string, timestampSec: number}>>}
   */
  async extractKeyframes(videoPath) {
    logger.info(`[FrameExtraction] Starting scene detection on: ${videoPath}`);

    // 1. ได้ duration ของวิดีโอ
    const duration = await this._getVideoDuration(videoPath);
    logger.info(`[FrameExtraction] Video duration: ${duration}s`);

    // 2. Scene detection → timestamps
    let timestamps = await this._detectSceneTimestamps(videoPath);
    logger.info(`[FrameExtraction] Scene detection found ${timestamps.length} candidates`);

    // 3. Fallback: ถ้าได้น้อยกว่า 3 → interval sampling
    if (timestamps.length < 3) {
      logger.warn('[FrameExtraction] Too few scenes detected → fallback to 30s interval');
      timestamps = this._intervalTimestamps(duration, 30);
    }

    // 4. Filter: ห่างกัน < MIN_INTERVAL_SEC → เอาแค่ตัวแรกของกลุ่ม
    timestamps = this._filterByMinInterval(timestamps, MIN_INTERVAL_SEC);

    // 5. Cap
    if (timestamps.length > MAX_PER_VIDEO) {
      logger.warn(`[FrameExtraction] Capping ${timestamps.length} → ${MAX_PER_VIDEO} frames`);
      timestamps = timestamps.slice(0, MAX_PER_VIDEO);
    }

    logger.info(`[FrameExtraction] Extracting ${timestamps.length} keyframes...`);

    // 6. Export frames ทีละอัน
    const frames = [];
    for (const ts of timestamps) {
      try {
        const framePath = await this._exportFrame(videoPath, ts);
        frames.push({ framePath, timestampSec: ts });
      } catch (err) {
        logger.warn(`[FrameExtraction] Failed to export frame at ${ts}s: ${err.message}`);
      }
    }

    logger.info(`[FrameExtraction] Done — ${frames.length} frames extracted`);
    return frames;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * รัน ffmpeg scene detection และ return array ของ timestamps (วินาที)
   *
   * ffmpeg command เทียบเท่า:
   *   ffmpeg -i input.mp4 -vf "select=gt(scene\,0.4),showinfo" -vsync vfr /dev/null
   * แล้ว parse "pts_time:" จาก stderr
   */
  _detectSceneTimestamps(videoPath) {
    return new Promise((resolve, reject) => {
      const timestamps = [];

      // Regex จับ pts_time จาก showinfo filter output
      const PTS_TIME_RE = /pts_time:([\d.]+)/;

      ffmpeg(videoPath)
        .outputOptions([
          '-vf', `select=gt(scene\\,${SCENE_THRESHOLD}),showinfo`,
          '-vsync', 'vfr',
          '-f',    'null'
        ])
        .output(process.platform === 'win32' ? 'NUL' : '/dev/null')
        .on('stderr', (line) => {
          const match = line.match(PTS_TIME_RE);
          if (match) {
            const ts = parseFloat(match[1]);
            if (!isNaN(ts)) timestamps.push(ts);
          }
        })
        .on('end', () => resolve(timestamps.sort((a, b) => a - b)))
        .on('error', (err) => {
          // scene detection อาจ error บางเครื่อง → resolve empty แล้ว fallback
          logger.warn(`[FrameExtraction] Scene detection warning: ${err.message}`);
          resolve([]);
        })
        .run();
    });
  }

  /**
   * สร้าง timestamp array แบบ interval
   * @param {number} duration  ความยาววิดีโอ (วินาที)
   * @param {number} interval  ห่างกันกี่วินาที
   */
  _intervalTimestamps(duration, interval) {
    const ts = [];
    // เริ่มที่ 5 วินาที (ข้าม intro)
    for (let t = 5; t < duration - 5; t += interval) {
      ts.push(Math.round(t * 10) / 10);
    }
    return ts;
  }

  /**
   * กรอง timestamps ให้ห่างกันอย่างน้อย minInterval วินาที
   */
  _filterByMinInterval(timestamps, minInterval) {
    if (timestamps.length === 0) return [];
    const result = [timestamps[0]];
    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] - result[result.length - 1] >= minInterval) {
        result.push(timestamps[i]);
      }
    }
    return result;
  }

  /**
   * Export frame เดี่ยว ณ timestamp → .jpg file
   * @returns {Promise<string>} framePath
   */
  _exportFrame(videoPath, timestampSec) {
    return new Promise((resolve, reject) => {
      const framePath = path.join(
        os.tmpdir(),
        `kb_frame_${Date.now()}_${Math.round(timestampSec)}.jpg`
      );

      ffmpeg(videoPath)
        .seekInput(timestampSec)
        .frames(1)
        .outputOptions(['-q:v', String(OUTPUT_QUALITY)])
        .output(framePath)
        .on('end', () => resolve(framePath))
        .on('error', reject)
        .run();
    });
  }

  /**
   * ดึง video duration ด้วย ffprobe
   */
  _getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, meta) => {
        if (err) reject(new Error(`ffprobe: ${err.message}`));
        else     resolve(parseFloat(meta.format.duration) || 0);
      });
    });
  }
}

module.exports = new FrameExtractionService();
