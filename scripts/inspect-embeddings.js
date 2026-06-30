const db = require('../src/models');

async function run() {
  try {
    console.log('Connecting to database...');
    await db.sequelize.authenticate();
    
    console.log('\n--- Knowledge Sources List ---');
    const sources = await db.KnowledgeSource.findAll({
      order: [['created_at', 'DESC']]
    });
    
    if (sources.length === 0) {
      console.log('No knowledge sources found.');
      return;
    }

    for (const src of sources) {
      const chunkCount = await db.DocumentChunk.count({ where: { source_id: src.source_id } });
      console.log(`ID: ${src.source_id} | Title: "${src.title}" | Media: ${src.media_type} | Clearance: ${src.required_clearance} | Chunks: ${chunkCount} | Status: ${src.status}`);
    }

    // If an ID is provided as an argument, inspect its chunks
    const args = process.argv.slice(2);
    if (args.length > 0) {
      const sourceId = parseInt(args[0], 10);
      console.log(`\n--- Inspecting Chunks for Source ID: ${sourceId} ---`);
      
      const chunks = await db.DocumentChunk.findAll({
        where: { source_id: sourceId },
        order: [['chunk_id', 'ASC']]
      });

      if (chunks.length === 0) {
        console.log('No chunks found for this source.');
        return;
      }

      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        console.log(`\n[Chunk ${i + 1}] ID: ${c.chunk_id}`);
        if (c.timestamp_start !== null && c.timestamp_start !== undefined) {
          console.log(`Time Range: ${formatTime(c.timestamp_start)} - ${formatTime(c.timestamp_end)}`);
        }
        console.log(`Text Preview: "${c.raw_text_content.slice(0, 150).replace(/\n/g, ' ')}..."`);
        
        // Show embedding details (first 5 dimensions and total dimensions)
        const vector = c.vector_embedding; // array/string representation depending on sequelize PG parser
        if (vector) {
          if (Array.isArray(vector)) {
            console.log(`Embedding Vector (${vector.length} dimensions): [${vector.slice(0, 5).join(', ')}, ...]`);
          } else {
            // If parsed as string or raw pgvector text format
            const parsed = String(vector).replace(/[\[\]]/g, '').split(',');
            console.log(`Embedding Vector (${parsed.length} dimensions): [${parsed.slice(0, 5).join(', ')}, ...]`);
          }
        } else {
          console.log(`Embedding Vector: NULL`);
        }
      }
    } else {
      console.log('\nTip: Run "node scripts/inspect-embeddings.js <source_id>" to view chunks and embedding vectors of a specific document/video.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.sequelize.close();
  }
}

function formatTime(secs) {
  if (secs === null || secs === undefined) return 'N/A';
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

run();
