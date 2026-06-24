const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { User } = require('../models');
const logger = require('../utils/logger');

// Generate access token (1 hour)
const generateAccessToken = (user) => {
  return jwt.sign(
    { userId: user.user_id, username: user.username },
    process.env.JWT_SECRET || 'your_jwt_secret_key_here',
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
};

// Generate refresh token (7 days)
const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user.user_id },
    process.env.JWT_REFRESH_SECRET || 'your_refresh_secret_key_here',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    logger.info(`User authenticated: ${user.username} (clearance: ${user.clearance_level})`);

    // In a real application, you might save the refresh token in database or httpOnly cookie.
    // Following AGENTS.md conventions, return tokens in response.
    return res.status(200).json({
      accessToken,
      refreshToken,
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

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'your_refresh_secret_key_here');
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User associated with this token no longer exists' });
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user); // token rotation

    return res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    // Stateless logout: Client simply discards the token.
    // If storing token in blacklist, add logic here.
    return res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  refresh,
  logout
};
