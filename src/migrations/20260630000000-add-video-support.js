'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ─── Alter ENUM to add VIDEO_TRANSCRIPT (Postgres only) ───
    if (queryInterface.sequelize.options.dialect === 'postgres') {
      try {
        await queryInterface.sequelize.query(
          `ALTER TYPE "enum_knowledge_sources_content_type" ADD VALUE 'VIDEO_TRANSCRIPT';`
        );
      } catch (e) {
        // Ignore if value already exists
        console.log('Skipping adding VIDEO_TRANSCRIPT to enum_knowledge_sources_content_type (might already exist):', e.message);
      }
    }

    // ─── knowledge_sources: media_type ───
    await queryInterface.addColumn('knowledge_sources', 'media_type', {
      type: Sequelize.ENUM('DOCUMENT', 'VIDEO'),
      allowNull: false,
      defaultValue: 'DOCUMENT',
      comment: 'ประเภทสื่อ: DOCUMENT = PDF/DOCX/TXT, VIDEO = MP4/MOV/WEBM'
    });

    // ─── knowledge_sources: video_duration_seconds ───
    await queryInterface.addColumn('knowledge_sources', 'video_duration_seconds', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'ความยาววิดีโอ (วินาที) — null สำหรับ DOCUMENT'
    });

    // ─── knowledge_sources: transcript_language ───
    await queryInterface.addColumn('knowledge_sources', 'transcript_language', {
      type: Sequelize.STRING(10),
      allowNull: true,
      comment: 'ภาษาที่ Whisper ตรวจจับ เช่น th, en'
    });

    // ─── document_chunks: timestamp_start ───
    await queryInterface.addColumn('document_chunks', 'timestamp_start', {
      type: Sequelize.FLOAT,
      allowNull: true,
      comment: 'เวลาเริ่มต้นในวิดีโอ (วินาที) — null สำหรับ DOCUMENT chunks'
    });

    // ─── document_chunks: timestamp_end ───
    await queryInterface.addColumn('document_chunks', 'timestamp_end', {
      type: Sequelize.FLOAT,
      allowNull: true,
      comment: 'เวลาสิ้นสุดในวิดีโอ (วินาที)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('document_chunks', 'timestamp_end');
    await queryInterface.removeColumn('document_chunks', 'timestamp_start');
    await queryInterface.removeColumn('knowledge_sources', 'transcript_language');
    await queryInterface.removeColumn('knowledge_sources', 'video_duration_seconds');
    await queryInterface.removeColumn('knowledge_sources', 'media_type');
    
    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query(
        "DROP TYPE IF EXISTS enum_knowledge_sources_media_type;"
      );
    }
  }
};
