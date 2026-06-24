const { CLEARANCE_LEVELS } = require('../config/constants');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    user_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    clearance_level: {
      type: DataTypes.ENUM(Object.values(CLEARANCE_LEVELS)),
      allowNull: false
    },
    department: {
      type: DataTypes.STRING(100),
      allowNull: false
    }
  }, {
    tableName: 'users',
    underscored: true,
    timestamps: true
  });

  User.associate = (models) => {
    User.hasMany(models.AuditLog, {
      foreignKey: 'user_id',
      as: 'auditLogs'
    });
  };

  return User;
};
