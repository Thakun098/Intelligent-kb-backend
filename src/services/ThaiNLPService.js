const axios = require('axios');
const logger = require('../utils/logger');

class ThaiNLPService {
  constructor() {
    this.sidecarURL = process.env.THAI_NLP_URL || 'http://localhost:8001';
  }

  /**
   * Sends text to PyThaiNLP sidecar microservice for tokenization
   * @param {string} text Thai text string
   * @returns {Promise<string>} Space separated tokenized Thai string
   */
  async tokenize(text) {
    try {
      if (!text || !text.trim()) return '';

      const response = await axios.post(`${this.sidecarURL}/tokenize`, {
        text
      }, {
        timeout: 120000 // 120s timeout
      });

      if (!response.data || typeof response.data.joined !== 'string') {
        throw new Error('Invalid response format from Thai NLP sidecar');
      }

      return response.data.joined;
    } catch (error) {
      // Fallback: If sidecar is offline, log error and return original text gracefully
      logger.error(`Thai tokenization sidecar call failed: ${error.message}. Proceeding with raw text.`);
      return text;
    }
  }
}

module.exports = new ThaiNLPService();
