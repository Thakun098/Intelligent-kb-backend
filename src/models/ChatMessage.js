module.exports = (sequelize, DataTypes) => {
  const ChatMessage = sequelize.define('ChatMessage', {
    message_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    session_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'chat_sessions',
        key: 'session_id'
      },
      onDelete: 'CASCADE'
    },
    role: {
      type: DataTypes.ENUM('user', 'assistant'),
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'chat_messages',
    underscored: true,
    timestamps: false
  });

  ChatMessage.associate = (models) => {
    ChatMessage.belongsTo(models.ChatSession, {
      foreignKey: 'session_id',
      as: 'session'
    });
  };

  return ChatMessage;
};
