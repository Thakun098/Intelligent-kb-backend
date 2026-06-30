/**
 * Builds the system prompt for the RAG pipeline.
 *
 * Design principles:
 * - Ground the LLM strictly to retrieved context (no hallucination)
 * - Allow the LLM to synthesize, explain, and summarize — not just quote verbatim
 * - Encourage practical, actionable answers
 * - Respond in the same language as the user's query (Thai/English)
 */
function buildSystemPrompt() {
  return `{retrieved_chunks}

คุณคือผู้ช่วยภายในองค์กรที่เชี่ยวชาญด้านเทคนิค ทำหน้าที่ตอบคำถามจากฐานความรู้ภายใน

## กฎสำคัญ
1. ตอบจาก [Context] เป็นหลัก
2. สามารถสรุปและอธิบายให้อ่านง่ายได้
3. หากไม่พบข้อมูลที่เกี่ยวข้อง ให้ตอบว่า
   "ไม่พบข้อมูลที่เกี่ยวข้องในฐานความรู้ กรุณาติดต่อทีมที่รับผิดชอบ"
4. ตอบด้วยภาษาเดียวกับคำถามของผู้ใช้

## รูปแบบคำตอบ
**สรุป**
สรุปคำตอบสั้น ๆ 1-2 ประโยค

**รายละเอียด**
อธิบายข้อมูลที่เกี่ยวข้องเป็นข้อ ๆ

**อ้างอิง**
ระบุเอกสารหรือแหล่งข้อมูลที่ใช้

[Context]
{retrieved_chunks}`;
}

function _formatTime(secs) {
  if (secs == null || isNaN(secs)) return null;
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Builds a formatted context string from retrieved document chunks.
 * Adds chunk index for traceability.
 *
 * @param {Object[]} chunks - Array of chunk objects with raw_text_content
 * @returns {string} Formatted context string
 */
function buildContext(chunks) {
  if (!chunks || chunks.length === 0) return '(ฟ้าใสไม่เข้าใจคำถามค่ะ)';

  return chunks.map((chunk, i) => {
    const src      = chunk.knowledgeSource || {};
    const isVideo  = src.media_type === 'VIDEO';
    const startFmt = _formatTime(chunk.timestamp_start);
    const endFmt   = _formatTime(chunk.timestamp_end);

    let label = `[ข้อมูล ${i + 1}] ${src.title || 'ไม่ระบุ'}`;
    if (isVideo && startFmt) label += ` (วิดีโอ ช่วงเวลา ${startFmt}–${endFmt})`;

    return `${label}\n${chunk.raw_text_content}`;
  }).join('\n\n---\n\n');
}

module.exports = {
  buildSystemPrompt,
  buildContext
};
