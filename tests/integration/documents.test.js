const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/models');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

// We bypass the queue processing in integration test, only checking upload route response
jest.mock('../../src/queues/documentQueue', () => ({
  add: jest.fn().mockResolvedValue({ id: 'mocked-job-id' })
}));

describe('Document Upload API Integration Tests', () => {
  let adminToken;
  let newbieToken;
  const testFilePath = path.resolve(__dirname, 'test-upload.txt');

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });

    // Seed password
    const password = await bcrypt.hash('Test@1234', 10);

    // Create users
    await db.User.create({
      username: 'admin_doc',
      password,
      clearance_level: 'CONFIDENTIAL_ADMIN',
      department: 'IT'
    });

    await db.User.create({
      username: 'newbie_doc',
      password,
      clearance_level: 'GENERAL_NEWBIE',
      department: 'HR'
    });

    // Login users to acquire tokens
    const loginAdmin = await request(app).post('/api/auth/login').send({ username: 'admin_doc', password: 'Test@1234' });
    adminToken = loginAdmin.body.accessToken;

    const loginNewbie = await request(app).post('/api/auth/login').send({ username: 'newbie_doc', password: 'Test@1234' });
    newbieToken = loginNewbie.body.accessToken;

    // Create dummy text file to upload
    fs.writeFileSync(testFilePath, 'This is standard dummy document content for testing.');
  });

  afterAll(async () => {
    // Clean up dummy file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    await db.sequelize.close();
  });

  test('POST /api/documents/upload - Access denied for GENERAL_NEWBIE user', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${newbieToken}`)
      .attach('file', testFilePath)
      .field('title', 'Unauthorized doc')
      .field('content_type', 'ONBOARDING_GUIDE')
      .field('required_clearance', 'GENERAL_NEWBIE');

    expect(res.statusCode).toEqual(403);
    expect(res.body.error).toContain('Insufficient clearance level');
  });

  test('POST /api/documents/upload - Success for CONFIDENTIAL_ADMIN user', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', testFilePath)
      .field('title', 'Authorized corporate guide')
      .field('content_type', 'ONBOARDING_GUIDE')
      .field('required_clearance', 'GENERAL_NEWBIE');

    expect(res.statusCode).toEqual(202);
    expect(res.body.message).toContain('Document uploaded successfully');
    expect(res.body).toHaveProperty('sourceId');

    // Clean up uploaded file from storage/uploads
    const doc = await db.KnowledgeSource.findByPk(res.body.sourceId);
    if (doc && fs.existsSync(doc.file_path)) {
      fs.unlinkSync(doc.file_path);
    }
  });

  test('POST /api/documents/upload - Rejects video files (Multer filter)', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', testFilePath, { filename: 'test.mp4', contentType: 'video/mp4' })
      .field('title', 'Video attempt')
      .field('content_type', 'VIDEO_TRANSCRIPT')
      .field('required_clearance', 'GENERAL_NEWBIE');

    expect(res.statusCode).toEqual(500);
    expect(res.body.error).toEqual('Internal Server Error');
  });
});
