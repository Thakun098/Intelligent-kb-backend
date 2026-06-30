const axios = require('axios');
const logger = require('../utils/logger');

class LLMService {
  constructor() {
    this.apiURL = process.env.THAI_LLM_API_URL;
    this.model = process.env.THAI_LLM_MODEL;
    this.apiKey = process.env.THAI_LLM_API_KEY;
  }

  /**
   * Streams chat response from Qwen2.5:3b model via Ollama
   * @param {string} systemPrompt Prompt enforcing constraints and inject context
   * @param {string} context Combined raw context chunk strings
   * @param {string} userQuery The user's input query
   * @returns {AsyncGenerator<string>} Yields tokens/pieces of text
   */
  async *streamChat(systemPrompt, context, userQuery) {
    console.log(this.model, this.apiURL, this.apiKey)
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const systemContent = systemPrompt.replace(/\{retrieved_chunks\}/g, context);

      const payload = {
        model: this.model,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user',   content: userQuery }
        ],
        max_tokens: 2048,
        temperature: 0.3,
        stream: true  // ← request SSE streaming from the API
      };

      logger.info(`Calling LLM API: ${this.apiURL} | model: ${this.model}`);

      const response = await axios.post(this.apiURL, payload, {
        headers,
        responseType: 'stream',   // ← Axios returns a Node.js Readable stream
        timeout: 280000
      });

      // Parse SSE stream: each line is either blank or "data: <json>"
      for await (const chunk of response.data) {
        const raw = chunk.toString();
        const lines = raw.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;

          const jsonStr = trimmed.startsWith('data: ')
            ? trimmed.slice(6)   // strip "data: " prefix
            : trimmed;

          try {
            const parsed = JSON.parse(jsonStr);

            // OpenAI / Pathumma streaming format
            if (parsed.choices?.[0]?.delta?.content) {
              yield parsed.choices[0].delta.content;
            }
            // Ollama streaming format
            else if (parsed.message?.content) {
              yield parsed.message.content;
            }
          } catch (_) {
            // skip unparseable lines (e.g. keep-alive comments)
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
