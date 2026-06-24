const { CLEARANCE_RANK } = require('../config/constants');

/**
 * Checks if the user clearance meets or exceeds the required clearance.
 * @param {string} userClearance Clearance level of the logged in user
 * @param {string} requiredClearance Clearance level required to access the document/resource
 * @returns {boolean}
 */
function hasAccess(userClearance, requiredClearance) {
  const userRank = CLEARANCE_RANK[userClearance] || 0;
  const requiredRank = CLEARANCE_RANK[requiredClearance] || 999;
  return userRank >= requiredRank;
}

module.exports = {
  hasAccess
};
