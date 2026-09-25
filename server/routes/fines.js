const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { transaction, sendError } = require('../lib/database');
const { ValidationError, clean, csvText } = require('../lib/records');
const { RETENTION_DAYS, purgeExpiredFines } = require('../lib/fineTrash');

router.use(authMiddleware);

const baseSelect = `SELECT f.*, s.name, s.registration_no, b.accession_no, b.title AS bookTitle
  FROM fines f JOIN students s ON s.id=f.student_id LEFT JOIN books b ON b.id=f.book_id`;

for (const status of ['unsent', 'sent']) router.get(`/${status}`, async (req, res) => {
  try {
    const [rows] = await db.promise().query(`${baseSelect} WHERE f.status=? ORDER BY f.created_at DESC,f.id DESC`, [status]);
    res.json(rows);
  } catch (error) { sendError(res, error); }
});

router.get('/trash', async (req, res) => {
  try {
    await purgeExpiredFines(db.promise());
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const search = clean(req.query.search);
    const where = search ? 'WHERE student_registration_no LIKE ? OR student_name LIKE ? OR book_accession_no LIKE ? OR CAST(fine_id AS CHAR) LIKE ?' : '';
    const params = search ? Array(4).fill(`%${search}%`) : [];
    const [countRows] = await db.promise().query(`SELECT COUNT(*) AS total FROM fine_deletions ${where}`, params);
    const [rows] = await db.promise().query(`
      SELECT id AS trashId, fine_id AS fineId, student_id AS studentId, book_id AS bookId, issue_id AS issueId,
        fine_amount AS fineAmount, days_late AS daysLate, fine_type AS fineType, reason,
        original_status AS originalStatus, sent_to_accounts AS sentToAccounts,
        resolution_status AS resolutionStatus, resolved_at AS resolvedAt,
        resolved_by AS resolvedBy, resolution_reason AS resolutionReason,
        original_created_at AS originalCreatedAt, student_registration_no AS registrationNo,
        student_name AS studentName, book_accession_no AS accessionNo, book_title AS bookTitle,
        deleted_by AS deletedBy, deleted_by_name AS deletedByName, deleted_by_email AS deletedByEmail,
        deletion_reason AS deletionReason, deleted_at AS deletedAt, expires_at AS expiresAt,
        GREATEST(0, DATEDIFF(expires_at, CURRENT_TIMESTAMP)) AS daysRemaining
      FROM fine_deletions
      ${where}
      ORDER BY deleted_at DESC, id DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, (page - 1) * limit]);
    res.json({ retentionDays: RETENTION_DAYS, total: Number(countRows[0].total), page, limit, rows });
  } catch (error) { sendError(res, error); }
});

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.promise().query(`${baseSelect} ORDER BY f.created_at DESC,f.id DESC`);
    res.json(rows.map(fine => ({ ...fine, statusText: fine.status === 'sent' ? 'Sent' : 'Unsent' })));
  } catch (error) { sendError(res, error); }
});

router.post('/create', async (req, res) => {
  try {
    const registration = clean(req.body.registration_no).toUpperCase();
    const accession = clean(req.body.accession_no).toUpperCase();
    const amount = Number(req.body.fine_amount);
    const reason = clean(req.body.reason);
    if (!registration || !Number.isFinite(amount) || amount <= 0 || amount > 99999999.99) throw new ValidationError('Enter a registration number and a fine amount greater than zero.');
    if (!reason || reason.length > 500) throw new ValidationError('Enter a fine reason of up to 500 characters.');
    const id = await transaction(async connection => {
      const [students] = await connection.query('SELECT id FROM students WHERE registration_no=? AND deleted_at IS NULL FOR UPDATE', [registration]);
      if (!students.length) throw new ValidationError('Student not found.', 404);
      let bookId = null;
      if (accession) {
        const [books] = await connection.query('SELECT id FROM books WHERE accession_no=? AND deleted_at IS NULL', [accession]);
        if (!books.length) throw new ValidationError('Book accession number not found.', 404);
        bookId = books[0].id;
      }
      const [result] = await connection.query("INSERT INTO fines(student_id,book_id,days_late,fine_amount,fine_type,reason,status) VALUES (?,?,0,?,'manual',?,'unsent')", [students[0].id, bookId, amount, reason]);
      return result.insertId;
    });
    res.status(201).json({ success: true, id });
  } catch (error) { sendError(res, error); }
});

async function moveToTrash(req, res) {
  try {
    const id = Number(req.params.id);
    const deletionReason = clean(req.body?.reason);
    if (!Number.isSafeInteger(id) || id < 1) throw new ValidationError('Invalid fine ID.');
    if (deletionReason.length < 3 || deletionReason.length > 500) throw new ValidationError('Enter a removal reason of 3–500 characters.');
    const result = await transaction(async connection => {
      await purgeExpiredFines(connection);
      const [rows] = await connection.query(`
        SELECT f.*, s.registration_no, s.name AS student_name,
          COALESCE(b.accession_no,'') AS accession_no, COALESCE(b.title,'') AS book_title
        FROM fines f
        JOIN students s ON s.id=f.student_id
        LEFT JOIN books b ON b.id=f.book_id
        WHERE f.id=? FOR UPDATE
      `, [id]);
      if (!rows.length) throw new ValidationError('Fine not found.', 404);
      const fine = rows[0];
      const [admins] = await connection.query('SELECT name,email FROM admins WHERE id=?', [req.user.id]);
      const admin = admins[0] || { name: '', email: req.user.email || '' };
      const [insert] = await connection.query(`
        INSERT INTO fine_deletions(
          fine_id,student_id,book_id,issue_id,fine_amount,days_late,fine_type,reason,
          original_status,sent_to_accounts,resolution_status,resolved_at,resolved_by,resolution_reason,original_created_at,
          student_registration_no,student_name,book_accession_no,book_title,
          deleted_by,deleted_by_name,deleted_by_email,deletion_reason,expires_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ${RETENTION_DAYS} DAY))
      `, [fine.id, fine.student_id, fine.book_id, fine.issue_id, fine.fine_amount, fine.days_late, fine.fine_type, fine.reason,
        fine.status, Number(fine.sentToAccounts) || 0, fine.resolution_status || 'pending', fine.resolved_at, fine.resolved_by, fine.resolution_reason || '', fine.created_at,
        fine.registration_no, fine.student_name, fine.accession_no, fine.book_title,
        req.user.id, admin.name, admin.email, deletionReason]);
      await connection.query('DELETE FROM fines WHERE id=?', [id]);
      const [trash] = await connection.query('SELECT id AS trashId, expires_at AS expiresAt FROM fine_deletions WHERE id=?', [insert.insertId]);
      return trash[0];
    });
    res.json({ success: true, retentionDays: RETENTION_DAYS, ...result });
  } catch (error) { sendError(res, error); }
}

router.post('/:id/trash', moveToTrash);
router.delete('/:id', moveToTrash);

router.post('/:id/resolve', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const resolution = clean(req.body?.resolution).toLowerCase();
    const reason = clean(req.body?.reason);
    if (!Number.isSafeInteger(id) || id < 1) throw new ValidationError('Invalid fine ID.');
    if (!['paid', 'waived'].includes(resolution)) throw new ValidationError('Resolution must be Paid or Waived.');
    if (reason.length < 3 || reason.length > 500) throw new ValidationError('Enter a resolution note of 3–500 characters.');
    await transaction(async connection => {
      const [rows] = await connection.query('SELECT resolution_status FROM fines WHERE id=? FOR UPDATE', [id]);
      if (!rows.length) throw new ValidationError('Fine not found.', 404);
      if ((rows[0].resolution_status || 'pending') !== 'pending') throw new ValidationError('This fine has already been resolved.', 409);
      await connection.query('UPDATE fines SET resolution_status=?,resolved_at=CURRENT_TIMESTAMP,resolved_by=?,resolution_reason=? WHERE id=?', [resolution, req.user.id, reason, id]);
    });
    res.json({ success: true, resolution });
  } catch (error) { sendError(res, error); }
});

router.post('/:id/reopen', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const reason = clean(req.body?.reason);
    if (!Number.isSafeInteger(id) || id < 1) throw new ValidationError('Invalid fine ID.');
    if (reason.length < 3 || reason.length > 500) throw new ValidationError('Enter a reopening reason of 3–500 characters.');
    const [result] = await db.promise().query("UPDATE fines SET resolution_status='pending',resolved_at=NULL,resolved_by=?,resolution_reason=? WHERE id=? AND resolution_status IN ('paid','waived')", [req.user.id, `Reopened: ${reason}`, id]);
    if (!result.affectedRows) throw new ValidationError('Resolved fine not found.', 404);
    res.json({ success: true });
  } catch (error) { sendError(res, error); }
});

router.get('/export/csv', async (req, res) => {
  try {
    const [rows] = await db.promise().query(`${baseSelect} ORDER BY f.created_at DESC,f.id DESC`);
    const headers = ['ID', 'Registration No', 'Student Name', 'Book Accession', 'Book Title', 'Fine Amount', 'Days Late', 'Type', 'Reason', 'Accounts Status', 'Resolution', 'Resolution Note', 'Date'];
    res.type('text/csv').attachment('fines-export.csv').send(csvText(headers, rows.map(row => [row.id, row.registration_no, row.name, row.accession_no, row.bookTitle, row.fine_amount, row.days_late, row.fine_type, row.reason, row.status, row.resolution_status || 'pending', row.resolution_reason || '', row.created_at])));
  } catch (error) { sendError(res, error); }
});

router.post('/send-to-account', async (req, res) => {
  try {
    const [result] = await db.promise().query("UPDATE fines SET status='sent',sentToAccounts=1 WHERE status='unsent' AND sentToAccounts=0 AND COALESCE(resolution_status,'pending')='pending'");
    res.json({ success: true, updated: result.affectedRows });
  } catch (error) { sendError(res, error); }
});

module.exports = router;
