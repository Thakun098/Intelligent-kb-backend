const serviceAuth = require('../../../src/middleware/serviceAuth');
const httpMocks = require('node-mocks-http');

describe('ServiceAuth Middleware Unit Tests', () => {
  const originalEnv = process.env.INTERNAL_SERVICE_API_KEY;

  afterEach(() => {
    process.env.INTERNAL_SERVICE_API_KEY = originalEnv;
  });

  test('Allows request when Authorization header matches configured key', () => {
    process.env.INTERNAL_SERVICE_API_KEY = 'super-secret-key';
    const req = httpMocks.createRequest({
      headers: {
        'Authorization': 'Bearer super-secret-key'
      }
    });
    const res = httpMocks.createResponse();
    const next = jest.fn();

    serviceAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  test('Blocks request with 401 when Authorization header is invalid', () => {
    process.env.INTERNAL_SERVICE_API_KEY = 'super-secret-key';
    const req = httpMocks.createRequest({
      headers: {
        'Authorization': 'Bearer wrong-key'
      }
    });
    const res = httpMocks.createResponse();
    const next = jest.fn();

    serviceAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Invalid or missing API key'
    });
  });

  test('Blocks request with 401 when Authorization header does not use Bearer scheme', () => {
    process.env.INTERNAL_SERVICE_API_KEY = 'super-secret-key';
    const req = httpMocks.createRequest({
      headers: {
        'authorization': 'Basic super-secret-key'
      }
    });
    const res = httpMocks.createResponse();
    const next = jest.fn();
    serviceAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  test('Blocks request with 503 when INTERNAL_SERVICE_API_KEY is not configured', () => {
    delete process.env.INTERNAL_SERVICE_API_KEY;
    const req = httpMocks.createRequest({
      headers: {
        'Authorization': 'Bearer some-key'
      }
    });
    const res = httpMocks.createResponse();
    const next = jest.fn();

    serviceAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Service temporarily unavailable'
    });
  });
});
