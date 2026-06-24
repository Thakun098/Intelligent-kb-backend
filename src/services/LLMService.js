const axios = require('axios');
const logger = require('../utils/logger');

class LLMService {
  constructor() {
    this.baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_LLM_MODEL || 'qwen2.5:3b';
  }

  /**
   * Streams chat response from Qwen2.5:3b model via Ollama
   * @param {string} systemPrompt Prompt enforcing constraints and inject context
   * @param {string} context Combined raw context chunk strings
   * @param {string} userQuery The user's input query
   * @returns {AsyncGenerator<string>} Yields tokens/pieces of text
   */
  async *streamChat(systemPrompt, context, userQuery) {
    try {
      const response = await axios.post(`${this.baseURL}/api/chat`, {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt.replace('{retrieved_chunks}', context)
          },
          {
            role: 'user',
            content: userQuery
          }
        ],
        options: {
          temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
          top_k: 40,
          top_p: 0.9,
          num_predict: 1024,
          repeat_penalty: 1.1
        },
        stream: true
      }, {
        responseType: 'stream',
        timeout: 180000 // 180s — larger models (9b+) need more time
      });

      const stream = response.data;

      // Helper function to read stream chunks line by line
      for await (const chunk of stream) {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.message && parsed.message.content) {
              yield parsed.message.content;
            }
          } catch (jsonErr) {
            // Ignore partial or unparseable lines in stream chunks
          }
        }
      }
    } catch (error) {
      logger.error(`LLM Chat Streaming failed: ${error.message}`);
      throw new Error(`LLM Service Error: ${error.message}`);
    }
  }
}

module.exports = new LLMService();
