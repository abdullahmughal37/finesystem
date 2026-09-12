const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { clean } = require('../lib/records');
const { sendError } = require('../lib/database');
const router = express.Router();
router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false, message: { valid: false, error: 'Too many verification requests. Try again later.' } }));

router.get('/:reference', async (req, res) => {
  try {
    const reference = clean(req.params.reference).toUpperCase();
    const [rows] = await db.promise().query(`SELECT reference_no,status,student_name,registration_no,purpose,issued_at,revoked_at,pdf_data,pdf_sha256 FROM clearance_letters WHERE reference_no=?`, [reference]);
    if (!rows.length) return res.status(404).json({ valid: false, error: 'Clearance reference not found.' });
    const row = rows[0];
    const intact = row.pdf_data && crypto.createHash('sha256').update(row.pdf_data).digest('hex') === row.pdf_sha256;
    if (!intact) return res.status(409).json({ valid: false, status: 'invalid', referenceNumber: row.reference_no, error: 'The stored document failed its integrity check.' });
    res.json({ valid: row.status === 'issued', referenceNumber: row.reference_no, status: row.status, studentName: row.student_name, registrationNumber: row.registration_no, purpose: row.purpose, issuedAt: row.issued_at, revokedAt: row.revoked_at });
  } catch (error) { sendError(res, error); }
});

module.exports = router;
