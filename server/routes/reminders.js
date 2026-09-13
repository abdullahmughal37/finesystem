const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();
const db = require('../db');
const config = require('../config');
const { authMiddleware } = require('../middleware/auth');
const { sendError } = require('../lib/database');

router.use(authMiddleware);

const smtpConfigured = () => Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);

router.get('/status', (_req, res) => {
  const configured = smtpConfigured();
  res.json({
    configured,
    message: configured
      ? 'Reminder email delivery is configured.'
      : 'Reminder email delivery is not configured. Add SMTP_HOST, SMTP_USER, and SMTP_PASS on the server.',
  });
});

const overdueSql = `
  SELECT s.registration_no, s.name, s.email, b.title AS book,
    DATE_FORMAT(i.due_date, '%Y-%m-%d') AS dueDate,
    DATEDIFF(CURDATE(), i.due_date) AS daysOverdue
  FROM issues i
  JOIN students s ON s.id = i.student_id
  JOIN books b ON b.id = i.book_id
  WHERE i.returned = 0 AND i.due_date < CURDATE()
  ORDER BY i.due_date, s.registration_no
`;

const validEmail = value => /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(String(value || '').trim());
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

router.get('/overdue', async (req, res) => {
  try {
    const [rows] = await db.promise().query(overdueSql);
    res.json(rows);
  } catch (error) { sendError(res, error); }
});

router.post('/send', async (req, res) => {
  try {
    if (!smtpConfigured()) {
      return res.status(503).json({ error: 'Reminder email is not configured. Add SMTP_HOST, SMTP_USER, and SMTP_PASS on the server.' });
    }
    const [rows] = await db.promise().query(overdueSql);
    const deliverable = rows.filter(row => validEmail(row.email));
    const skipped = rows.length - deliverable.length;
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
    const results = await Promise.allSettled(deliverable.map(row => transporter.sendMail({
      from: config.smtp.user,
      to: row.email,
      subject: 'Library - Overdue Book Reminder',
      html: `<p>Dear ${escapeHtml(row.name)},</p><p>Your borrowed book <strong>${escapeHtml(row.book)}</strong> was due on ${escapeHtml(row.dueDate)}.</p>`,
    })));
    const sent = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.length - sent;
    res.status(failed ? 502 : 200).json({ success: failed === 0, sent, failed, skipped, total: rows.length, message: failed ? 'Some reminder emails could not be delivered.' : 'Reminder emails processed.' });
  } catch (error) { sendError(res, error); }
});

module.exports = router;
