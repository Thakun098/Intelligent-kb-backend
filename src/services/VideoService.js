/**
 * VideoService.js
 * Free Tier Constraints handled:
 *   - Max 25MB/request  → auto-split audio ทุก GROQ_SEGMENT_DURATION_SEC
 *   - Rate limit        → delay ระหว่าง requests + auto-retry บน 429
 *   - ~2 audio hrs/day  → เพียงพอสำหรับ 3 คลิป 30 นาที (= 1.5 ชม/วัน)
 */
const ffmpeg     = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const Groq       = require('groq-sdk');
const fs         = require('fs');
const path       = require('path');
const os         = require('os');
const logger     = require('../utils/logger');

ffmpeg.setFfmpegPath(ffmpegPath);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class VideoService {
  constructor() {
    this.groq               = new Groq({ apiKey: process.env.GROQ_API_KEY });
    this.whisperModel       = process.env.GROQ_WHISPER_MODEL          || 'whisper-large-v3';
    this.maxAudioBytes      = parseInt(process.env.GROQ_AUDIO_MAX_BYTES     || '24000000', 10);
    this.segmentDurationSec = parseInt(process.env.GROQ_SEGMENT_DURATION_SEC || '1500',    10);
    this.apiDelayMs         = parseInt(process.env.GROQ_API_DELAY_MS         || '2000',    10);
  }

  // ── PUBLIC ────────────────────────────────────────────────────

  async processVideo(videoPath) {
    const tmpFiles = [];
    try {
      // 1. Extract audio
      const tmpAudio = path.join(os.tmpdir(), `kb_audio_${Date.now()}.mp3`);
      tmpFiles.push(tmpAudio);
      await this._extractAudio(videoPath, tmpAudio);

      // 2. Split if needed
      const audioStat = fs.statSync(tmpAudio);
      let audioPaths;
      if (audioStat.size > this.maxAudioBytes) {
        audioPaths = await this._splitAudioByDuration(tmpAudio, this.segmentDurationSec);
        tmpFiles.push(...audioPaths);
      } else {
        audioPaths = [tmpAudio];
      }

      // 3. Transcribe each segment
      let allSegments = [], textParts = [], language = 'th', totalDuration = 0, timeOffset = 0;

      for (let i = 0; i < audioPaths.length; i++) {
        if (i > 0) await sleep(this.apiDelayMs);
        logger.info(`[VideoService] Transcribing ${i+1}/${audioPaths.length} (offset=${timeOffset}s)`);

        const result = await this._transcribeSegment(audioPaths[i], timeOffset);
        textParts.push(result.text.trim());
        allSegments  = allSegments.concat(result.segments);
        language     = result.language || language;
        timeOffset  += result.duration || this.segmentDurationSec;
        totalDuration += result.duration || 0;
      }

      return {
        fullText:      textParts.join(' ').replace(/\s+/g, ' ').trim(),
        segments:      allSegments,
        language,
        totalDuration
      };

    } finally {
      for (const f of tmpFiles) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
      }
    }
  }

  // ── PRIVATE ───────────────────────────────────────────────────

  _extractAudio(videoPath, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioFrequency(16000)  // Whisper optimal
        .audioChannels(1)       // mono — ลด size 50%
        .audioBitrate('64k')    // balance quality vs size
        .output(outputPath)
        .on('end', resolve)
        .on('error', (err) => reject(new Error(`ffmpeg: ${err.message}`)))
        .run();
    });
  }

  async _splitAudioByDuration(audioPath, segSec) {
    const duration = await this._getAudioDuration(audioPath);
    const count    = Math.ceil(duration / segSec);
    const paths    = [];

    for (let i = 0; i < count; i++) {
      const segPath = path.join(os.tmpdir(), `kb_seg_${Date.now()}_${i}.mp3`);
      await new Promise((resolve, reject) => {
        const cmd = ffmpeg(audioPath).setStartTime(i * segSec).output(segPath);
        if (i < count - 1) cmd.setDuration(segSec);
        cmd.on('end', resolve).on('error', reject).run();
      });
      paths.push(segPath);
    }
    return paths;
  }

  _getAudioDuration(audioPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, meta) => {
        if (err) reject(new Error(`ffprobe: ${err.message}`));
        else     resolve(parseFloat(meta.format.duration) || 0);
      });
    });
  }

  async _transcribeSegment(audioPath, timeOffset = 0) {
    try {
      const transcription = await this.groq.audio.transcriptions.create({
        file:                    fs.createReadStream(audioPath),
        model:                   this.whisperModel,
        response_format:         'verbose_json',
        timestamp_granularities: ['segment']
        // ไม่ force language เพื่อรองรับ TH/EN mixed content
      });

      const segments = (transcription.segments || []).map((seg) => ({
        id:    seg.id,
        start: parseFloat((seg.start + timeOffset).toFixed(2)),
        end:   parseFloat((seg.end   + timeOffset).toFixed(2)),
        text:  seg.text.trim()
      }));

      return {
        text:     transcription.text || '',
        segments,
        language: transcription.language || 'th',
        duration: parseFloat(transcription.duration) || 0
      };

    } catch (error) {
      if (error.status === 429) {
        logger.warn('[VideoService] Groq 429 — retrying after 60s...');
        await sleep(60000);
        return this._transcribeSegment(audioPath, timeOffset);
      }
      throw new Error(`Groq Whisper failed: ${error.message}`);
    }
  }
}

module.exports = new VideoService();
