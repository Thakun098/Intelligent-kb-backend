const { CLEARANCE_LEVELS, CONTENT_TYPES, SOURCE_STATUS } = require('../config/constants');

module.exports = (sequelize, DataTypes) => {
  const KnowledgeSource = sequelize.define('KnowledgeSource', {
    source_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    content_type: {
      type: DataTypes.ENUM(Object.values(CONTENT_TYPES)),
      allowNull: false
    },
    file_path: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    required_clearance: {
      type: DataTypes.ENUM(Object.values(CLEARANCE_LEVELS)),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM(Object.values(SOURCE_STATUS)),
      allowNull: false,
      defaultValue: SOURCE_STATUS.PENDING_PROCESSING
    },
    embedding_model: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'nomic-embed-text'
    }
  }, {
    tableName: 'knowledge_sources',
    underscored: true,
    timestamps: true
  });

  KnowledgeSource.associate = (models) => {
    KnowledgeSource.hasMany(models.DocumentChunk, {
      foreignKey: 'source_id',
      as: 'chunks',
      onDelete: 'CASCADE'
    });
    KnowledgeSource.hasOne(models.PostMortemDetail, {
      foreignKey: 'source_id',
      as: 'postMortemDetail',
      onDelete: 'CASCADE'
    });
  };

  return KnowledgeSource;
};
