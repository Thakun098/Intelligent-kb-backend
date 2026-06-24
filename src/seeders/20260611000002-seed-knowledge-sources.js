'use strict';

const { CLEARANCE_LEVELS, CONTENT_TYPES, SOURCE_STATUS } = require('../config/constants');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert('knowledge_sources', [
      {
        title: 'คู่มือปฐมนิเทศพนักงานใหม่ 2026',
        content_type: CONTENT_TYPES.ONBOARDING_GUIDE,
        file_path: '/app/storage/uploads/onboarding_2026.pdf',
        required_clearance: CLEARANCE_LEVELS.GENERAL_NEWBIE,
        status: SOURCE_STATUS.ACTIVE,
        embedding_model: 'nomic-embed-text',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        title: 'บันทึกแก้ไขระบบล่มระบบจ่ายเงินล้มเหลว (Error 500)',
        content_type: CONTENT_TYPES.POST_MORTEM_ERROR,
        file_path: '/app/storage/uploads/post_mortem_err500.pdf',
        required_clearance: CLEARANCE_LEVELS.PERMANENT_STAFF,
        status: SOURCE_STATUS.ACTIVE,
        embedding_model: 'nomic-embed-text',
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('knowledge_sources', null, {});
  }
};
