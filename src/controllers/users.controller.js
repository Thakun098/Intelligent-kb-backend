const { User } = require('../models');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');

const listUsers = async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: ['user_id', 'username', 'clearance_level', 'department', 'created_at']
    });
    return res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { username, password, clearance_level, department } = req.body;
    if (!username || !password || !clearance_level || !department) {
      return res.status(400).json({ error: 'username, password, clearance_level, and department are required fields' });
    }

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const hashedPassword = await bcrypt.hash(password, rounds);

    const user = await User.create({
      username,
      password: hashedPassword,
      clearance_level,
      department
    });

    logger.info(`Admin created user: ${username} (clearance: ${clearance_level})`);

    return res.status(201).json({
      message: 'User created successfully',
      user: {
        userId: user.user_id,
        username: user.username,
        clearanceLevel: user.clearance_level,
        department: user.department
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { clearance_level, department } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (clearance_level) user.clearance_level = clearance_level;
    if (department) user.department = department;

    await user.save();

    logger.info(`Admin updated user profile: ${user.username}`);

    return res.status(200).json({
      message: 'User profile updated successfully',
      user: {
        userId: user.user_id,
        username: user.username,
        clearanceLevel: user.clearance_level,
        department: user.department
      }
    });
  } catch (error) {
    next(error);
  }
};

const deactivateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // In a production app, we would add an isActive column or status enum.
    // For this implementation plan, we delete or deactivate. Let's delete the record or invalidate it.
    await user.destroy();
    
    logger.info(`Admin deleted/deactivated user ID: ${id}`);
    return res.status(200).json({ message: 'User deactivated and removed successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listUsers,
  createUser,
  updateUser,
  deactivateUser
};
