'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('post_mortem_details', {
      detail_id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      source_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'knowledge_sources',
          key: 'source_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      symptom: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      root_cause: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      resolution: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      prevention: {
        type: Sequelize.TEXT,
        allowNull: false
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
    await queryInterface.dropTable('post_mortem_details');
  }
};
