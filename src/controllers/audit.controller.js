const { AuditLog, User } = require('../models');

const listAuditLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '10', 10);
    const offset = (page - 1) * limit;

    const { count, rows } = await AuditLog.findAndCountAll({
      order: [['timestamp', 'DESC']],
      limit,
      offset,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['username', 'department', 'clearance_level']
        }
      ]
    });

    return res.status(200).json({
      total: count,
      page,
      limit,
      pages: Math.ceil(count / limit),
      logs: rows
    });
  } catch (error) {
    next(error);
  }
};

const getAuditLogDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const log = await AuditLog.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['username', 'department', 'clearance_level']
        }
      ]
    });

    if (!log) {
      return res.status(404).json({ error: 'Audit log entry not found' });
    }

    return res.status(200).json(log);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listAuditLogs,
  getAuditLogDetail
};
