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
  return `คุณคือผู้ช่วยภายในองค์กรที่เชี่ยวชาญด้านเทคนิค ทำหน้าที่ตอบคำถามจากฐานความรู้ภายใน

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

## แนวทางการเขียน

* ใช้ Bullet List เมื่อเหมาะสม
* หลีกเลี่ยงข้อความยาวต่อเนื่อง
* ตอบให้กระชับและอ่านง่าย

[Context]
{retrieved_chunks}
`;
}

/**
 * Builds a formatted context string from retrieved document chunks.
 * Adds chunk index for traceability.
 *
 * @param {Object[]} chunks - Array of chunk objects with raw_text_content
 * @returns {string} Formatted context string
 */
function buildContext(chunks) {
  if (!chunks || chunks.length === 0) return '(ไม่มีข้อมูลที่เกี่ยวข้อง)';
  return chunks
    .map((chunk, i) => `[ข้อมูล ${i + 1}]\n${chunk.raw_text_content}`)
    .join('\n\n---\n\n');
}

module.exports = {
  buildSystemPrompt,
  buildContext
};
