module.exports = (sequelize, DataTypes) => {
  const ChatSession = sequelize.define('ChatSession', {
    session_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'user_id'
      },
      onDelete: 'CASCADE'
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'New Chat'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'chat_sessions',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  ChatSession.associate = (models) => {
    ChatSession.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
    ChatSession.hasMany(models.ChatMessage, {
      foreignKey: 'session_id',
      as: 'messages'
    });
  };

  return ChatSession;
};
