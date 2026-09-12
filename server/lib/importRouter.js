const express = require('express');
const multer = require('multer');
const { parseImport, csvText, ValidationError } = require('./records');
const { importRecords } = require('./catalog');
const { sendError } = require('./database');
const { getLayout, checkRevision } = require('./layouts');
module.exports = function importRouter(kind) {
  const router = express.Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 }, fileFilter: (req, file, cb) => cb(/\.csv$/i.test(file.originalname) ? null : new ValidationError('Choose a CSV UTF-8 file.'), /\.csv$/i.test(file.originalname)) });
  router.get('/template.csv', async (req, res) => {
    try {const layout=await getLayout(kind);res.type('text/csv').attachment(`${kind}-template.csv`).send(csvText(layout.fields.filter(f=>!f.archived && f.showInForm).map(f=>f.label),[]));}
    catch(error){sendError(res,error);}
  });
  router.post('/import', (req, res) => upload.single('file')(req, res, async error => {
    if (error) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'CSV must be 5 MB or smaller.' : error.message });
    try {
      if (!req.file) throw new ValidationError('Choose a CSV file.');
      const layout=await getLayout(kind);checkRevision(layout,req.query.revision);
      const parsed = await parseImport(req.file.buffer, kind, layout);
      res.json(await importRecords(kind, parsed, req.query.preview === 'true', layout.revision));
    } catch (error) { sendError(res, error); }
  }));
  return router;
};
