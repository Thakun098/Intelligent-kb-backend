/**
 * re-embed.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Re-generates vector embeddings for ALL active document_chunks using the
 * current OLLAMA_EMBEDDING_MODEL configured in .env.
 *
 * Usage:
 *   node scripts/re-embed.js
 *
 * When to run:
 *   - After switching embedding models (e.g. nomic-embed-text → bge-m3)
 *   - After changing EMBEDDING_DIMENSION in .env
 *   - When vector_embedding column dimension and model output mismatch
 *
 * ⚠️  WARNING: This will UPDATE all existing embeddings. Ensure the Ollama
 *    embedding model is running before executing this script.
 * ─────────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const axios = require('axios');
const { Sequelize, QueryTypes } = require('sequelize');

// ── Config ──────────────────────────────────────────────────────────────────
const OLLAMA_BASE_URL   = process.env.OLLAMA_BASE_URL   || 'http://localhost:11434';
const EMBEDDING_MODEL   = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
const EMBEDDING_DIM     = parseInt(process.env.EMBEDDING_DIMENSION || '768', 10);
const LLM_API_KEY       = process.env.LLM_API_KEY || process.env.OLLAMA_API_KEY || '';
const BATCH_DELAY_MS    = 100; // Delay between requests to avoid overwhelming Ollama

const DB_CONFIG = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME     || 'kb_system',
  username: process.env.DB_USER     || 'kb_user',
  password: process.env.DB_PASSWORD || 'supersecretpassword',
  dialect:  'postgres',
  logging:  false
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function embedText(text) {
  const headers = {};
  if (LLM_API_KEY) {
    headers['Authorization'] = `Bearer ${LLM_API_KEY}`;
  }

  const response = await axios.post(`${OLLAMA_BASE_URL}/api/embeddings`, {
    model: EMBEDDING_MODEL,
    prompt: text
  }, {
    headers,
    timeout: 180000
  });

  if (!response.data || !response.data.embedding) {
    throw new Error('Invalid response format from Ollama Embeddings API');
  }

  const embedding = response.data.embedding;
  if (embedding.length !== EMBEDDING_DIM) {
    throw new Error(
      `Embedding dimension mismatch: model returned ${embedding.length} but EMBEDDING_DIMENSION=${EMBEDDING_DIM}`
    );
  }

  return embedding;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Re-Embed Script');
  console.log(`  Model   : ${EMBEDDING_MODEL}`);
  console.log(`  Dimension: ${EMBEDDING_DIM}`);
  console.log(`  DB      : ${DB_CONFIG.database}@${DB_CONFIG.host}:${DB_CONFIG.port}`);
  console.log('═══════════════════════════════════════════════════════');

  const sequelize = new Sequelize(DB_CONFIG);

  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established.\n');
  } catch (err) {
    console.error('❌ Cannot connect to database:', err.message);
    process.exit(1);
  }

  // Fetch all chunks (no status filter — re-embed everything including DEPRECATED sources)
  const chunks = await sequelize.query(
    'SELECT chunk_id, raw_text_content FROM document_chunks ORDER BY created_at ASC',
    { type: QueryTypes.SELECT }
  );

  if (chunks.length === 0) {
    console.log('ℹ️  No document chunks found in the database. Nothing to re-embed.');
    await sequelize.close();
    return;
  }

  console.log(`📄 Found ${chunks.length} chunk(s) to re-embed.\n`);

  let successCount = 0;
  let failCount    = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const progress = `[${i + 1}/${chunks.length}]`;

    try {
      const embedding = await embedText(chunk.raw_text_content);
      const embeddingStr = `[${embedding.join(',')}]`;

      await sequelize.query(
        'UPDATE document_chunks SET vector_embedding = :embedding::vector, updated_at = NOW() WHERE chunk_id = :chunkId',
        {
          replacements: { embedding: embeddingStr, chunkId: chunk.chunk_id },
          type: QueryTypes.UPDATE
        }
      );

      successCount++;
      process.stdout.write(`\r${progress} ✅ Embedded chunk ${chunk.chunk_id.substring(0, 8)}...`);
    } catch (err) {
      failCount++;
      console.error(`\n${progress} ❌ Failed chunk ${chunk.chunk_id}: ${err.message}`);
    }

    // Small delay to avoid overwhelming Ollama
    if (i < chunks.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  await sequelize.close();

  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log(`  Re-Embed Complete`);
  console.log(`  ✅ Success : ${successCount}`);
  console.log(`  ❌ Failed  : ${failCount}`);
  console.log(`  Total     : ${chunks.length}`);
  console.log('═══════════════════════════════════════════════════════');

  if (failCount > 0) {
    console.warn('\n⚠️  Some chunks failed. Re-run this script to retry failed chunks.');
    process.exit(1);
  } else {
    console.log('\n🎉 All chunks successfully re-embedded!');
    console.log('   You can now restart the backend server.');
  }
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err.message);
  process.exit(1);
});
