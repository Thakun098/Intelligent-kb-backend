require('dotenv').config();
const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/models');
const bcrypt = require('bcrypt');
const EmbeddingService = require('../../src/services/EmbeddingService');
const LLMService = require('../../src/services/LLMService');

jest.mock('../../src/services/EmbeddingService');
jest.mock('../../src/services/LLMService');

const dim = parseInt(process.env.EMBEDDING_DIMENSION || '768', 10);

describe('Query RAG Integration Tests', () => {
  let staffToken;
  let newbieToken;
  let newbieUser;
  let staffUser;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });

    // Hash passwords
    const password = await bcrypt.hash('Test@1234', 10);

    // Create users
    newbieUser = await db.User.create({
      username: 'newbie02',
      password,
      clearance_level: 'GENERAL_NEWBIE',
      department: 'HR'
    });

    staffUser = await db.User.create({
      username: 'staff_dev02',
      password,
      clearance_level: 'PERMANENT_STAFF',
      department: 'Dev'
    });

    // Login users to acquire tokens
    const loginNewbie = await request(app).post('/api/auth/login').send({ username: 'newbie02', password: 'Test@1234' });
    newbieToken = loginNewbie.body.accessToken;

    const loginStaff = await request(app).post('/api/auth/login').send({ username: 'staff_dev02', password: 'Test@1234' });
    staffToken = loginStaff.body.accessToken;

    // Create knowledge sources
    const newbieDoc = await db.KnowledgeSource.create({
      title: 'Newbie Manual',
      content_type: 'ONBOARDING_GUIDE',
      file_path: '/dummy/path1',
      required_clearance: 'GENERAL_NEWBIE',
      status: 'ACTIVE'
    });

    const staffDoc = await db.KnowledgeSource.create({
      title: 'Dev Server Manual',
      content_type: 'ONBOARDING_GUIDE',
      file_path: '/dummy/path2',
      required_clearance: 'PERMANENT_STAFF',
      status: 'ACTIVE'
    });

    // Create mock embeddings in DB.
    // Use orthogonal unit vectors (all zeros except one dimension) so that
    // cosine similarity between newbieVector and staffVector is exactly 0,
    // ensuring the threshold filter (>= 0.75) reliably excludes mismatched pairs.
    const newbieVector = new Array(dim).fill(0.0);
    newbieVector[0] = 1.0; // unit vector pointing along dimension 0

    const staffVector = new Array(dim).fill(0.0);
    staffVector[1] = 1.0; // unit vector pointing along dimension 1 (orthogonal to newbieVector)

    await db.DocumentChunk.create({
      source_id: newbieDoc.source_id,
      page_number: 1,
      raw_text_content: 'GENERAL_INFO: Welcome onboarding guide to company.',
      vector_embedding: newbieVector
    });

    await db.DocumentChunk.create({
      source_id: staffDoc.source_id,
      page_number: 1,
      raw_text_content: 'STAFF_ONLY: Dev database coordinates are confidential.',
      vector_embedding: staffVector
    });
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  test('POST /api/query - GENERAL_NEWBIE can retrieve GENERAL_NEWBIE content', async () => {
    // Mock Embedding to return vector identical to the NEWBIE chunk (cosine similarity = 1.0)
    const mockQueryVector = new Array(dim).fill(0.0);
    mockQueryVector[0] = 1.0;
    EmbeddingService.embed.mockResolvedValue(mockQueryVector);

    // Mock LLM streamChat output
    async function* mockStream() {
      yield 'Mocked LLM Onboarding Answer.';
    }
    LLMService.streamChat.mockReturnValue(mockStream());

    const res = await request(app)
      .post('/api/query')
      .set('Authorization', `Bearer ${newbieToken}`)
      .send({ query: 'onboarding guide information' });

    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Mocked LLM Onboarding Answer.');
    
    // Check audit log was saved
    const log = await db.AuditLog.findOne({ where: { user_id: newbieUser.user_id } });
    expect(log).not.toBeNull();
    expect(log.user_query).toEqual('onboarding guide information');
  });

  test('POST /api/query - GENERAL_NEWBIE receives fallback when searching for PERMANENT_STAFF content', async () => {
    // Mock Embedding to return the STAFF vector — orthogonal to the NEWBIE chunk,
    // so the only accessible chunk (NEWBIE) will score ~0.0 and be below threshold.
    const mockQueryVector = new Array(dim).fill(0.0);
    mockQueryVector[1] = 1.0; // points along dimension 1, orthogonal to newbieVector
    EmbeddingService.embed.mockResolvedValue(mockQueryVector);

    const res = await request(app)
      .post('/api/query')
      .set('Authorization', `Bearer ${newbieToken}`)
      .send({ query: 'server credentials' });

    expect(res.statusCode).toEqual(200);
    // Should get fallback message since the newbie profile clearance rank is 1 and the staff manual requires 2
    expect(res.text).toContain('ไม่พบข้อมูลระบบที่เกี่ยวข้องกับคำถามนี้ กรุณาติดต่อผู้รับผิดชอบโดยตรง');
  });

  test('POST /api/query - PERMANENT_STAFF can retrieve PERMANENT_STAFF content', async () => {
    // Mock Embedding to return vector identical to the STAFF chunk (cosine similarity = 1.0)
    const mockQueryVector = new Array(dim).fill(0.0);
    mockQueryVector[1] = 1.0;
    EmbeddingService.embed.mockResolvedValue(mockQueryVector);

    async function* mockStream() {
      yield 'Mocked LLM Staff credentials answer.';
    }
    LLMService.streamChat.mockReturnValue(mockStream());

    const res = await request(app)
      .post('/api/query')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ query: 'server credentials' });

    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Mocked LLM Staff credentials answer.');
  });
});
