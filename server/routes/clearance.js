const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');
const { transaction, sendError } = require('../lib/database');
const { ValidationError, clean } = require('../lib/records');
const { DEFAULT_TEMPLATE, CORE_TOKENS, normalizeTemplate, renderClearancePdf, renderPendingClearancePdf, pdfHash, clearanceCheck } = require('../lib/clearance');

const router = express.Router();
const uploads = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploads)) fs.mkdirSync(uploads, { recursive: true });
const storage = multer.diskStorage({ destination: uploads, filename: (_req, file, cb) => cb(null, `signature-${crypto.randomUUID()}${file.mimetype === 'image/png' ? '.png' : '.jpg'}`) });
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, cb) => cb(['image/png', 'image/jpeg'].includes(file.mimetype) ? null : new Error('Use a PNG or JPEG signature image.'), ['image/png', 'image/jpeg'].includes(file.mimetype)) });

async function settingsObject(connection) {
  const [rows] = await connection.query('SELECT setting_key,setting_value FROM settings');
  return Object.fromEntries(rows.map(row => [row.setting_key, row.setting_value]));
}

async function activeTemplate(connection) {
  const [rows] = await connection.query('SELECT * FROM clearance_templates WHERE is_active=1 ORDER BY version DESC,id DESC LIMIT 1');
  if (rows.length) return { ...rows[0], config: normalizeTemplate(JSON.parse(rows[0].config_json || '{}')) };
  const settings = await settingsObject(connection);
  const config = normalizeTemplate({ ...DEFAULT_TEMPLATE, universityName: settings.universityName || DEFAULT_TEMPLATE.universityName, campus: settings.campus || DEFAULT_TEMPLATE.campus, address: settings.address || DEFAULT_TEMPLATE.address, logoUrl: settings.logoUrl || '' });
  const [insert] = await connection.query('INSERT INTO clearance_templates(name,version,config_json,is_active) VALUES (?,1,?,1)', [config.name, JSON.stringify(config)]);
  return { id: insert.insertId, name: config.name, version: 1, config_json: JSON.stringify(config), is_active: 1, config };
}

router.get('/template', async (_req, res) => {
  try {
    const template = await activeTemplate(db.promise());
    const [layout] = await db.promise().query("SELECT fields FROM catalog_layouts WHERE kind='students'");
    const customTokens = layout.length ? JSON.parse(layout[0].fields).filter(field => !field.archived).map(field => ({ key: field.core ? ({ name:'student_name',registration_no:'registration_number',father_name:'father_name',department:'department',semester:'semester',status:'student_status',email:'student_email',contact_no:'contact_number' }[field.key] || field.key) : field.key, label: field.label })) : [];
    res.json({ id: template.id, version: template.version, config: template.config, tokens: [...new Map([...CORE_TOKENS.map(key => [key, { key, label: key.replaceAll('_', ' ') }]), ...customTokens.map(token => [token.key, token])]).values()] });
  } catch (error) { sendError(res, error); }
});

router.post('/template', async (req, res) => {
  try {
    const result = await transaction(async connection => {
      const current = await activeTemplate(connection);
      const config = normalizeTemplate(req.body?.config || {});
      await connection.query('UPDATE clearance_templates SET is_active=0 WHERE is_active=1');
      const [insert] = await connection.query('INSERT INTO clearance_templates(name,version,config_json,is_active,created_by) VALUES (?,?,?,?,?)', [config.name, Number(current.version) + 1, JSON.stringify(config), 1, req.user.id]);
      return { id: insert.insertId, version: Number(current.version) + 1, config };
    });
    res.status(201).json({ success: true, ...result });
  } catch (error) { sendError(res, error); }
});

router.post('/template/signature', (req, res) => upload.single('signature')(req, res, error => {
  if (error) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Signature image must be 2 MB or smaller.' : error.message });
  if (!req.file) return res.status(400).json({ error: 'Choose a signature image.' });
  res.json({ success: true, signatureUrl: `/uploads/${req.file.filename}` });
}));

router.get('/check/:studentId', async (req, res) => {
  try {
    const id = Number(req.params.studentId);
    if (!Number.isSafeInteger(id) || id < 1) throw new ValidationError('Invalid student ID.');
    res.json(await clearanceCheck(db.promise(), id));
  } catch (error) { sendError(res, error); }
});

router.get('/pending/:studentId/pdf', async (req, res) => {
  try {
    const id = Number(req.params.studentId);
    if (!Number.isSafeInteger(id) || id < 1) throw new ValidationError('Invalid student ID.');
    const check = await clearanceCheck(db.promise(), id);
    if (check.eligible) throw new ValidationError('This student has no pending library obligations.', 409);
    const template = await activeTemplate(db.promise());
    const issueDate = new Date().toLocaleDateString('en-CA', { timeZone: process.env.LIBRARY_TIMEZONE || 'Asia/Karachi' });
    const pdf = await renderPendingClearancePdf({ check, template: template.config, issueDate });
    res.type('application/pdf').attachment(`pending-clearance-${check.student.registration_no}.pdf`).send(pdf);
  } catch (error) { sendError(res, error); }
});

router.post('/issue', async (req, res) => {
  try {
    const studentId = Number(req.body?.studentId);
    const purpose = clean(req.body?.purpose);
    if (!Number.isSafeInteger(studentId) || studentId < 1) throw new ValidationError('Select a student.');
    if (purpose.length < 3 || purpose.length > 150) throw new ValidationError('Enter a purpose of 3–150 characters.');
    const result = await transaction(async connection => {
      const check = await clearanceCheck(connection, studentId, true);
      if (!check.eligible) throw new ValidationError('Clearance cannot be issued while books or fines remain unresolved.', 409, 'clearance_blocked');
      const template = await activeTemplate(connection);
      const year = new Date().toLocaleDateString('en-CA', { timeZone: process.env.LIBRARY_TIMEZONE || 'Asia/Karachi', year: 'numeric' });
      await connection.query('INSERT INTO clearance_sequences(sequence_year,next_number) VALUES (?,1) ON DUPLICATE KEY UPDATE sequence_year=VALUES(sequence_year)', [year]);
      const [sequenceRows] = await connection.query('SELECT next_number FROM clearance_sequences WHERE sequence_year=? FOR UPDATE', [year]);
      const number = Number(sequenceRows[0].next_number);
      await connection.query('UPDATE clearance_sequences SET next_number=next_number+1 WHERE sequence_year=?', [year]);
      const referenceNumber = `${template.config.referencePrefix}-${year}-${String(number).padStart(6, '0')}`;
      const issueDate = new Date().toLocaleDateString('en-CA', { timeZone: process.env.LIBRARY_TIMEZONE || 'Asia/Karachi' });
      const [admins] = await connection.query('SELECT name,email FROM admins WHERE id=?', [req.user.id]);
      const admin = admins[0] || { name: '', email: req.user.email || '' };
      const studentSnapshot = { ...check.student };
      delete studentSnapshot.custom_data;
      try { studentSnapshot.custom_data = typeof check.student.custom_data === 'string' ? JSON.parse(check.student.custom_data || '{}') : (check.student.custom_data || {}); } catch { studentSnapshot.custom_data = {}; }
      const pdf = await renderClearancePdf({ student: check.student, template: template.config, referenceNumber, purpose, issueDate });
      const [insert] = await connection.query(`INSERT INTO clearance_letters(reference_no,student_id,student_name,registration_no,purpose,status,student_snapshot,clearance_snapshot,template_snapshot,template_version,generated_by,generated_by_name,generated_by_email,issued_at,pdf_data,pdf_sha256) VALUES (?,?,?,?,?,'issued',?,?,?,?,?,?,?,CURRENT_TIMESTAMP,?,?)`, [referenceNumber, studentId, check.student.name, check.student.registration_no, purpose, JSON.stringify(studentSnapshot), JSON.stringify({ eligible: true, activeIssues: [], unresolvedFines: [], fineTotal: 0, checkedAt: new Date().toISOString() }), JSON.stringify(template.config), template.version, req.user.id, admin.name, admin.email, pdf, pdfHash(pdf)]);
      return { id: insert.insertId, referenceNumber, issuedAt: issueDate };
    });
    res.status(201).json({ success: true, ...result });
  } catch (error) { sendError(res, error); }
});

router.get('/letters', async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const search = clean(req.query.search);
    const where = search ? 'WHERE reference_no LIKE ? OR student_name LIKE ? OR registration_no LIKE ?' : '';
    const params = search ? Array(3).fill(`%${search}%`) : [];
    const [count] = await db.promise().query(`SELECT COUNT(*) total FROM clearance_letters ${where}`, params);
    const [rows] = await db.promise().query(`SELECT id,reference_no AS referenceNumber,student_id AS studentId,student_name AS studentName,registration_no AS registrationNumber,purpose,status,template_version AS templateVersion,generated_by_name AS generatedByName,issued_at AS issuedAt,revoked_at AS revokedAt,revocation_reason AS revocationReason FROM clearance_letters ${where} ORDER BY issued_at DESC,id DESC LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]);
    res.json({ rows, total: Number(count[0].total), page, limit });
  } catch (error) { sendError(res, error); }
});

router.get('/letters/:id/pdf', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new ValidationError('Invalid clearance letter ID.');
    const [rows] = await db.promise().query('SELECT reference_no,pdf_data,pdf_sha256 FROM clearance_letters WHERE id=?', [id]);
    if (!rows.length) throw new ValidationError('Clearance letter not found.', 404);
    const pdf = rows[0].pdf_data;
    if (!pdf || pdfHash(pdf) !== rows[0].pdf_sha256) throw new ValidationError('The stored PDF failed its integrity check. Contact the administrator.', 409);
    res.type('application/pdf').attachment(`${rows[0].reference_no}.pdf`).send(pdf);
  } catch (error) { sendError(res, error); }
});

router.post('/letters/:id/revoke', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const reason = clean(req.body?.reason);
    if (!Number.isSafeInteger(id) || id < 1) throw new ValidationError('Invalid clearance letter ID.');
    if (reason.length < 3 || reason.length > 500) throw new ValidationError('Enter a revocation reason of 3–500 characters.');
    const result = await transaction(async connection => {
      const [rows] = await connection.query('SELECT status FROM clearance_letters WHERE id=? FOR UPDATE', [id]);
      if (!rows.length) throw new ValidationError('Clearance letter not found.', 404);
      if (rows[0].status === 'revoked') throw new ValidationError('This clearance letter is already revoked.', 409);
      await connection.query("UPDATE clearance_letters SET status='revoked',revoked_at=CURRENT_TIMESTAMP,revoked_by=?,revocation_reason=? WHERE id=?", [req.user.id, reason, id]);
      return { success: true };
    });
    res.json(result);
  } catch (error) { sendError(res, error); }
});

module.exports = router;
