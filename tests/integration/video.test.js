const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/models');

jest.mock('../../src/queues/videoQueue', () => ({
  add: jest.fn().mockResolvedValue({ id: 'mocked-video-job-id' })
}));

describe('Video Process API Integration Tests', () => {
  const originalEnv = process.env.INTERNAL_SERVICE_API_KEY;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    process.env.INTERNAL_SERVICE_API_KEY = 'test-service-key';
  });

  afterAll(async () => {
    process.env.INTERNAL_SERVICE_API_KEY = originalEnv;
    await db.sequelize.close();
  });

  test('POST /api/videos/process - Success with valid API key and payload', async () => {
    const payload = {
      videoUrl: 'http://storage-service:9000/uploads/meeting-q3.mp4',
      title: 'Meeting Recording Q3 2025',
      required_clearance: 'PERMANENT_STAFF',
      content_type: 'VIDEO_TRANSCRIPT',
      enable_frame_captioning: true,
      source_service: 'video-upload-service'
    };

    const res = await request(app)
      .post('/api/videos/process')
      .set('x-service-api-key', 'test-service-key')
      .send(payload);

    expect(res.statusCode).toEqual(202);
    expect(res.body.message).toContain('Video processing queued');
    expect(res.body).toHaveProperty('sourceId');
    expect(res.body.status).toEqual('PENDING_PROCESSING');

    // Check DB record
    const source = await db.KnowledgeSource.findByPk(res.body.sourceId);
    expect(source).not.toBeNull();
    expect(source.title).toEqual(payload.title);
    expect(source.media_type).toEqual('VIDEO');
    expect(source.file_path).toBeNull();
  });

  test('POST /api/videos/process - Missing API key returns 401', async () => {
    const payload = {
      videoUrl: 'http://storage-service:9000/uploads/meeting-q3.mp4',
      title: 'Meeting Recording Q3 2025',
      required_clearance: 'PERMANENT_STAFF'
    };

    const res = await request(app)
      .post('/api/videos/process')
      .send(payload);

    expect(res.statusCode).toEqual(401);
    expect(res.body.error).toEqual('Invalid or missing API key');
  });

  test('POST /api/videos/process - Invalid API key returns 401', async () => {
    const payload = {
      videoUrl: 'http://storage-service:9000/uploads/meeting-q3.mp4',
      title: 'Meeting Recording Q3 2025',
      required_clearance: 'PERMANENT_STAFF'
    };

    const res = await request(app)
      .post('/api/videos/process')
      .set('x-service-api-key', 'wrong-key')
      .send(payload);

    expect(res.statusCode).toEqual(401);
    expect(res.body.error).toEqual('Invalid or missing API key');
  });

  test('POST /api/videos/process - Invalid payload returns 400 (missing title)', async () => {
    const payload = {
      videoUrl: 'http://storage-service:9000/uploads/meeting-q3.mp4',
      required_clearance: 'PERMANENT_STAFF'
    };

    const res = await request(app)
      .post('/api/videos/process')
      .set('x-service-api-key', 'test-service-key')
      .send(payload);

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toEqual('Validation failed');
    expect(res.body.details).toContain('"title" is required');
  });

  test('POST /api/videos/process - Invalid videoUrl scheme returns 400', async () => {
    const payload = {
      videoUrl: 'ftp://storage-service:9000/uploads/meeting-q3.mp4',
      title: 'Meeting Recording Q3 2025',
      required_clearance: 'PERMANENT_STAFF'
    };

    const res = await request(app)
      .post('/api/videos/process')
      .set('x-service-api-key', 'test-service-key')
      .send(payload);

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toEqual('Validation failed');
  });

  test('POST /api/videos/process - Service not configured returns 503', async () => {
    delete process.env.INTERNAL_SERVICE_API_KEY;
    const payload = {
      videoUrl: 'http://storage-service:9000/uploads/meeting-q3.mp4',
      title: 'Meeting Recording Q3 2025',
      required_clearance: 'PERMANENT_STAFF'
    };

    const res = await request(app)
      .post('/api/videos/process')
      .set('x-service-api-key', 'test-service-key')
      .send(payload);

    expect(res.statusCode).toEqual(503);
    expect(res.body.error).toEqual('Service temporarily unavailable');
  });
});
