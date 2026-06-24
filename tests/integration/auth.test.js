const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/models');
const bcrypt = require('bcrypt');

describe('Auth Integration Tests', () => {
  beforeAll(async () => {
    // Sync DB and clean up tables
    await db.sequelize.sync({ force: true });
    
    // Seed test users
    const rounds = 10;
    const password = await bcrypt.hash('Test@1234', rounds);
    
    await db.User.create({
      username: 'test_user',
      password: password,
      clearance_level: 'PERMANENT_STAFF',
      department: 'Testing'
    });
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  test('POST /api/auth/login - Success with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'test_user',
        password: 'Test@1234'
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.username).toEqual('test_user');
    expect(res.body.user.clearanceLevel).toEqual('PERMANENT_STAFF');
  });

  test('POST /api/auth/login - Fail with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'test_user',
        password: 'WrongPassword'
      });

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty('error');
  });

  test('POST /api/auth/refresh - Refresh access token', async () => {
    // 1. Login first to get refresh token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'test_user',
        password: 'Test@1234'
      });

    const { refreshToken } = loginRes.body;

    // 2. Perform refresh
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });
});
