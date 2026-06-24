module.exports = (sequelize, DataTypes) => {
  const DocumentChunk = sequelize.define('DocumentChunk', {
    chunk_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    source_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'knowledge_sources',
        key: 'source_id'
      }
    },
    page_number: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    raw_text_content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    vector_embedding: {
      type: (() => {
        const VectorType = class extends DataTypes.ABSTRACT {
          constructor() {
            super();
            this.key = `vector(${process.env.EMBEDDING_DIMENSION || 768})`;
            this._stringify = function(value) {
              return `[${value.join(',')}]`;
            };
            this._value = function(value) {
              return `[${value.join(',')}]`;
            };
          }
          toSql() {
            return this.key;
          }
        };
        // Ensure Sequelize query generator wraps the string value in quotes
        VectorType.prototype.escape = true;
        return new VectorType();
      })(),
      allowNull: true
    }
  }, {
    tableName: 'document_chunks',
    underscored: true,
    timestamps: true
  });

  DocumentChunk.associate = (models) => {
    DocumentChunk.belongsTo(models.KnowledgeSource, {
      foreignKey: 'source_id',
      as: 'knowledgeSource'
    });
  };

  return DocumentChunk;
};
