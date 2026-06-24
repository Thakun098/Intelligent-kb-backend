const axios = require('axios');
const logger = require('../utils/logger');

class EmbeddingService {
  constructor() {
    this.baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
  }

  /**
   * Generates a 768-dimensional float embedding for a given input text
   * @param {string} text The string to embed
   * @returns {Promise<number[]>} Array of 768 float values
   */
  async embed(text) {
    try {
      if (!text || typeof text !== 'string') {
        throw new Error('Input text must be a non-empty string');
      }

      // Ollama embedding endpoint: POST /api/embeddings or /api/embed
      // Modern Ollama recommends /api/embed but supports /api/embeddings
      const response = await axios.post(`${this.baseURL}/api/embeddings`, {
        model: this.model,
        prompt: text
      }, {
        timeout: 120000 // 120s timeout for large models like bge-m3
      });

      if (!response.data || !response.data.embedding) {
        throw new Error('Invalid response format from Ollama Embeddings API');
      }

      return response.data.embedding;
    } catch (error) {
      logger.error(`Embedding generation failed: ${error.message}`);
      throw new Error(`Embedding Service Error: ${error.message}`);
    }
  }
}

module.exports = new EmbeddingService();
