const { hasAccess } = require('../../../src/utils/clearanceHelper');

describe('Clearance Helper Unit Tests', () => {
  test('GENERAL_NEWBIE clearance access matches', () => {
    expect(hasAccess('GENERAL_NEWBIE', 'GENERAL_NEWBIE')).toBe(true);
    expect(hasAccess('GENERAL_NEWBIE', 'PERMANENT_STAFF')).toBe(false);
    expect(hasAccess('GENERAL_NEWBIE', 'CONFIDENTIAL_ADMIN')).toBe(false);
  });

  test('PERMANENT_STAFF clearance access matches', () => {
    expect(hasAccess('PERMANENT_STAFF', 'GENERAL_NEWBIE')).toBe(true);
    expect(hasAccess('PERMANENT_STAFF', 'PERMANENT_STAFF')).toBe(true);
    expect(hasAccess('PERMANENT_STAFF', 'CONFIDENTIAL_ADMIN')).toBe(false);
  });

  test('CONFIDENTIAL_ADMIN clearance access matches', () => {
    expect(hasAccess('CONFIDENTIAL_ADMIN', 'GENERAL_NEWBIE')).toBe(true);
    expect(hasAccess('CONFIDENTIAL_ADMIN', 'PERMANENT_STAFF')).toBe(true);
    expect(hasAccess('CONFIDENTIAL_ADMIN', 'CONFIDENTIAL_ADMIN')).toBe(true);
  });
});
