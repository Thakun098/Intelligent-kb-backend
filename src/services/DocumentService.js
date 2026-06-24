const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const logger = require('../utils/logger');

class DocumentService {
  /**
   * Extracts raw text from a document based on its extension/mimetype
   * @param {string} filePath Absolute path to file on disk
   * @param {string} mimeType File mime type
   * @returns {Promise<string>} Cleaned string content
   */
  async extractText(filePath, mimeType) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File does not exist at path: ${filePath}`);
      }

      const fileBuffer = fs.readFileSync(filePath);

      if (mimeType === 'application/pdf') {
        const data = await pdfParse(fileBuffer);
        return data.text || '';
      } 
      
      if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const data = await mammoth.extractRawText({ buffer: fileBuffer });
        return data.value || '';
      } 
      
      if (mimeType === 'text/plain') {
        return fileBuffer.toString('utf-8');
      }

      throw new Error(`Unsupported mime type: ${mimeType}`);
    } catch (error) {
      logger.error(`Document text extraction failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new DocumentService();
