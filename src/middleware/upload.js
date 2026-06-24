const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Define disk storage configurations
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save to configuration directory. Defaults to root storage folder
    const uploadDir = process.env.UPLOAD_DIR || path.resolve(__dirname, '..', '..', 'storage', 'uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate secure randomized filename to prevent conflicts
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

// Define type whitelisting filters
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'text/plain'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'), false);
  }
};

const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '52428800', 10); // Default 50MB

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSize
  }
});

module.exports = upload;
