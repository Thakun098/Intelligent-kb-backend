'use strict';

const { CLEARANCE_LEVELS, CONTENT_TYPES, SOURCE_STATUS } = require('../config/constants');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('knowledge_sources', {
      source_id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      content_type: {
        type: Sequelize.ENUM(Object.values(CONTENT_TYPES)),
        allowNull: false
      },
      file_path: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      required_clearance: {
        type: Sequelize.ENUM(Object.values(CLEARANCE_LEVELS)),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM(Object.values(SOURCE_STATUS)),
        allowNull: false,
        defaultValue: SOURCE_STATUS.PENDING_PROCESSING
      },
      embedding_model: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'nomic-embed-text'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('knowledge_sources');
    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_knowledge_sources_content_type";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_knowledge_sources_required_clearance";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_knowledge_sources_status";');
    }
  }
};
