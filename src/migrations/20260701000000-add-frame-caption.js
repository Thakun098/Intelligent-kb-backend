'use strict';

/**
 * Migration: เพิ่ม column frame_caption ใน document_chunks
 *
 * เก็บ Gemini Vision caption แยกไว้จาก raw_text_content
 * ประโยชน์:
 *   1. Debug: ดูได้ว่า Gemini เห็นอะไรในแต่ละ chunk
 *   2. UI: แสดง "visual context" ให้ user เห็นว่า chunk มาจากภาพอะไร
 *   3. Analytics: วัดได้ว่ากี่ % ของ video chunks มี caption
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('document_chunks', 'frame_caption', {
      type:      Sequelize.TEXT,
      allowNull: true,
      comment:   'Gemini Vision caption ของ keyframe ที่ใกล้ timestamp นี้ที่สุด — null ถ้า disabled หรือไม่มี visual content'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('document_chunks', 'frame_caption');
  }
};
