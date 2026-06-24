/**
 * seed-postmortem.js
 * 
 * Direct seeder script to insert the Post-Mortem error document into the
 * knowledge base with real embeddings from Ollama (nomic-embed-text).
 * 
 * Bypasses the Bull Queue — runs synchronously for quick seeding.
 * 
 * Usage:
 *   node scripts/seed-postmortem.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { sequelize, KnowledgeSource, DocumentChunk } = require('../src/models');

// ─── Config ──────────────────────────────────────────────────────────────────

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '800', 10);
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || '150', 10);

const DOC_PATH = path.resolve(__dirname, '../../storage/uploads/post-mortem-2026-06-11.txt');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Split text into overlapping chunks
 */
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start += chunkSize - overlap;
  }
  return chunks;
}

/**
 * Get embedding vector from Ollama nomic-embed-text
 */
async function embed(text) {
  const response = await axios.post(`${OLLAMA_BASE_URL}/api/embeddings`, {
    model: EMBEDDING_MODEL,
    prompt: text
  }, { timeout: 30000 });
  return response.data.embedding; // float[768]
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 KB Seeder — Post-Mortem 2026-06-11');
  console.log(`   Ollama: ${OLLAMA_BASE_URL}`);
  console.log(`   Model:  ${EMBEDDING_MODEL}`);
  console.log(`   File:   ${DOC_PATH}`);
  console.log('');

  // 1. Check Ollama is accessible
  try {
    await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 5000 });
    console.log('✅ Ollama is reachable');
  } catch (err) {
    console.error('❌ Cannot reach Ollama at', OLLAMA_BASE_URL);
    console.error('   Make sure Ollama is running: `ollama serve`');
    process.exit(1);
  }

  // 2. Check file exists
  if (!fs.existsSync(DOC_PATH)) {
    console.error('❌ Document file not found:', DOC_PATH);
    process.exit(1);
  }

  // 3. Connect to DB
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }

  // 4. Read document
  const rawText = fs.readFileSync(DOC_PATH, 'utf8');
  console.log(`📄 Document loaded: ${rawText.length} characters`);

  // 5. Check if this document is already seeded
  const existing = await KnowledgeSource.findOne({
    where: { title: 'Post-Mortem: KB System Dev Errors 2026-06-11' }
  });
  if (existing) {
    console.log(`⚠️  Document already exists (source_id: ${existing.source_id}). Skipping.`);
    console.log('   Delete it first if you want to re-seed:');
    console.log(`   DELETE FROM document_chunks WHERE source_id = ${existing.source_id};`);
    console.log(`   DELETE FROM knowledge_sources WHERE source_id = ${existing.source_id};`);
    await sequelize.close();
    return;
  }

  // 6. Create KnowledgeSource record
  const source = await KnowledgeSource.create({
    title: 'Post-Mortem: KB System Dev Errors 2026-06-11',
    content_type: 'POST_MORTEM_ERROR',
    file_path: DOC_PATH,
    required_clearance: 'PERMANENT_STAFF',
    status: 'PENDING_PROCESSING'
  });
  console.log(`✅ KnowledgeSource created: ID ${source.source_id}`);

  // 7. Chunk the document
  const chunks = chunkText(rawText);
  console.log(`📦 Chunked into ${chunks.length} pieces (size=${CHUNK_SIZE}, overlap=${CHUNK_OVERLAP})`);

  // 8. Embed and insert each chunk
  let inserted = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunkText_ = chunks[i];
    process.stdout.write(`   Embedding chunk ${i + 1}/${chunks.length}... `);
    
    try {
      const embedding = await embed(chunkText_);
      
      await DocumentChunk.create({
        source_id: source.source_id,
        page_number: i + 1,
        raw_text_content: chunkText_,
        vector_embedding: embedding
      });

      console.log(`✅ (dim: ${embedding.length})`);
      inserted++;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
    }
  }

  // 9. Mark as ACTIVE
  source.status = 'ACTIVE';
  await source.save();
  console.log('');
  console.log(`✅ Knowledge source marked ACTIVE`);
  console.log(`📊 Inserted ${inserted}/${chunks.length} chunks`);
  console.log('');
  console.log('🎉 Done! You can now query the system about:');
  console.log('   - "วิธีแก้ Jest parallel test crash"');
  console.log('   - "ECONNRESET error during database sync"');
  console.log('   - "pgvector custom type Sequelize"');
  console.log('   - "Swagger YAML colon error"');
  console.log('   - "Joi validation username underscore"');

  await sequelize.close();
}

main().catch(async (err) => {
  console.error('💥 Fatal error:', err.message);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
