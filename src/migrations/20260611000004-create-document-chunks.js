'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Enable pgvector extension
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS vector;');

    // 2. Create document_chunks table
    await queryInterface.createTable('document_chunks', {
      chunk_id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false
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
      page_number: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      raw_text_content: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      // Note: Sequelize doesn't natively support pgvector type, so we use a custom type representation
      // We will define it as vector(768) in Postgres
      vector_embedding: {
        type: `vector(${process.env.EMBEDDING_DIMENSION || 768})`,
        allowNull: true
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

    // 3. Create index for cosine distance vector search
    // Using HNSW or IVFFlat. Let's create an HNSW or IVFFlat index.
    // ivfflat index needs vectors to exist first, or we can use hnsw which is more modern and doesn't require training lists.
    // Let's use HNSW or IVFFlat. The plan mentions: CREATE INDEX ON document_chunks USING ivfflat (vector_embedding vector_cosine_ops);
    // Let's implement IVFFlat:
    await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS document_chunks_vector_embedding_idx ON document_chunks USING ivfflat (vector_embedding vector_cosine_ops);');
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('document_chunks');
  }
};
