const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

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
    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});

// Define type whitelisting filters
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    // Documents
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'text/plain',
    // Videos
    'video/mp4',
    'video/quicktime',  // .mov
    'video/webm',
    'video/x-msvideo',  // .avi
    // Audio
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/x-m4a',
    'audio/m4a',
    'audio/x-aac',
    'audio/aac'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOCX, TXT, video (MP4, MOV, WEBM, AVI) and audio (MP3, WAV, M4A) files are allowed.'), false);
  }
};

const maxVideoSize = parseInt(process.env.MAX_VIDEO_FILE_SIZE || '3221225472', 10); // Default 3GB (3221225472 bytes)

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxVideoSize
  }
});

module.exports = upload;
