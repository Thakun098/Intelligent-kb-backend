module.exports = (sequelize, DataTypes) => {
  const PostMortemDetail = sequelize.define('PostMortemDetail', {
    detail_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
    symptom: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    root_cause: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    resolution: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    prevention: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, {
    tableName: 'post_mortem_details',
    underscored: true,
    timestamps: true
  });

  PostMortemDetail.associate = (models) => {
    PostMortemDetail.belongsTo(models.KnowledgeSource, {
      foreignKey: 'source_id',
      as: 'knowledgeSource'
    });
  };

  return PostMortemDetail;
};
