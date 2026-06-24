const rbacMiddleware = require('../../../src/middleware/rbac');
const httpMocks = require('node-mocks-http');

describe('RBAC Middleware Unit Tests', () => {
  test('Allows request when user clearance meets or exceeds requirement', () => {
    const req = httpMocks.createRequest({
      user: { clearanceLevel: 'PERMANENT_STAFF', username: 'test' }
    });
    const res = httpMocks.createResponse();
    const next = jest.fn();

    const middleware = rbacMiddleware('GENERAL_NEWBIE');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200); // unaffected
  });

  test('Blocks request with 403 when user clearance level is insufficient', () => {
    const req = httpMocks.createRequest({
      user: { clearanceLevel: 'GENERAL_NEWBIE', username: 'test' }
    });
    const res = httpMocks.createResponse();
    const next = jest.fn();

    const middleware = rbacMiddleware('CONFIDENTIAL_ADMIN');
    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Access Denied: Insufficient clearance level'
    });
  });
});
