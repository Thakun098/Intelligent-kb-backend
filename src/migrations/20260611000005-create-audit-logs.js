'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('immutable_audit_logs', {
      log_id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'user_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      user_query: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      ai_output: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      accessed_chunk_ids: {
        type: Sequelize.ARRAY(Sequelize.UUID),
        allowNull: false,
        defaultValue: []
      },
      timestamp: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create a database trigger to make the table read-only/append-only
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Audit logs are immutable. UPDATE/DELETE not allowed.';
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryInterface.sequelize.query(`
      CREATE TRIGGER audit_immutable
      BEFORE UPDATE OR DELETE ON immutable_audit_logs
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
    `);
  },
  down: async (queryInterface, Sequelize) => {
    // Drop trigger and function first
    await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS audit_immutable ON immutable_audit_logs;');
    await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS prevent_audit_modification();');
    await queryInterface.dropTable('immutable_audit_logs');
  }
};
