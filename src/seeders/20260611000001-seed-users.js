'use strict';

const bcrypt = require('bcrypt');
const { CLEARANCE_LEVELS } = require('../config/constants');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const rounds = 12;
    const adminPassword = await bcrypt.hash('Admin@1234', rounds);
    const staffPassword = await bcrypt.hash('Staff@1234', rounds);
    const newbiePassword = await bcrypt.hash('Newbie@1234', rounds);

    return queryInterface.bulkInsert('users', [
      {
        username: 'admin',
        password: adminPassword,
        clearance_level: CLEARANCE_LEVELS.CONFIDENTIAL_ADMIN,
        department: 'IT',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        username: 'staff_dev',
        password: staffPassword,
        clearance_level: CLEARANCE_LEVELS.PERMANENT_STAFF,
        department: 'Dev',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        username: 'newbie01',
        password: newbiePassword,
        clearance_level: CLEARANCE_LEVELS.GENERAL_NEWBIE,
        department: 'HR',
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('users', null, {});
  }
};
