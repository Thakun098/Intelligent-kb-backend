const axios = require('axios');
const logger = require('../utils/logger');

class EmbeddingService {
  constructor() {
    // EMBEDDING_API_URL = full endpoint for embedding API
    // Falls back to OLLAMA_BASE_URL + /api/embeddings for local Ollama
    this.apiURL = process.env.EMBEDDING_API_URL || `${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/embeddings`;
    this.model = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
    this.apiKey = process.env.LLM_API_KEY || process.env.OLLAMA_API_KEY || '';
  }

  /**
   * Generates a float embedding for a given input text.
   * Output dimension is controlled by OLLAMA_EMBEDDING_MODEL:
   *   - nomic-embed-text → 768 dims
   *   - bge-m3           → 1024 dims
   * @param {string} text The string to embed
   * @returns {Promise<number[]>} Array of float values (dimension depends on model)
   */
  async embed(text) {
    try {
      if (!text || typeof text !== 'string') {
        throw new Error('Input text must be a non-empty string');
      }

      // Ollama embedding endpoint: POST /api/embeddings or /api/embed
      // Modern Ollama recommends /api/embed but supports /api/embeddings
      const headers = {};
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await axios.post(this.apiURL, {
        model: this.model,
        prompt: text
      }, {
        headers,
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
