const fs = require('fs');
const path = require('path');

const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'uploads');

fs.mkdirSync(uploadDir, { recursive: true });

module.exports = uploadDir;
