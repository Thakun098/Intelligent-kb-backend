'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('knowledge_sources', 'file_path', {
      type: Sequelize.STRING(500),
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Note: If reverting, ensure there are no null values in file_path column
    await queryInterface.changeColumn('knowledge_sources', 'file_path', {
      type: Sequelize.STRING(500),
      allowNull: false
    });
  }
};
