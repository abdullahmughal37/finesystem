const express = require('express');
const router = express.Router();
const db = require('../db');
const { save, remove, pageOptions } = require('../lib/catalog');
const { sendError } = require('../lib/database');
const { today } = require('../lib/policy');
router.get('/', async (req, res) => {
  try {
    const { page, limit, offset, search } = pageOptions(req.query);
    const where = search ? "WHERE b.title LIKE ? OR b.accession_no LIKE ? OR b.author_name LIKE ? OR b.isbn LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(b.custom_data, '$.*')) LIKE ?" : '';
    const args = search ? Array(5).fill(`%${search}%`) : [];
    const [count] = await db.promise().query(`SELECT COUNT(*) total FROM books b ${where}`, args);
    const [rows] = await db.promise().query(`SELECT b.*, (SELECT COUNT(*) FROM issues i WHERE i.book_id=b.id AND returned=0) issuedCount, (SELECT COUNT(*) FROM issues i WHERE i.book_id=b.id AND returned=0 AND due_date<?) overdueCount FROM books b ${where} ORDER BY b.id DESC LIMIT ? OFFSET ?`, [today(), ...args, limit, offset]);
    const [stats] = await db.promise().query(`SELECT COUNT(*) total, SUM(EXISTS(SELECT 1 FROM issues i WHERE i.book_id=b.id AND returned=0)) issued, SUM(EXISTS(SELECT 1 FROM issues i WHERE i.book_id=b.id AND returned=0 AND due_date<?)) overdue FROM books b`, [today()]);
    res.json({ rows, total: count[0].total, page, limit, stats: { total: Number(stats[0].total), issued: Number(stats[0].issued), available: Number(stats[0].total)-Number(stats[0].issued), overdue: Number(stats[0].overdue) } });
  } catch (error) { sendError(res, error); }
});
router.post('/', async (req, res) => {
  try { const id=await save('books', req.body); res.status(201).json({success:true,id}); } catch(error) {sendError(res,error);}
});
router.put('/:id', async (req, res) => {
  try { await save('books',req.body,Number(req.params.id));res.json({success:true}); } catch(error) {sendError(res,error);}
});
router.delete('/:id', async (req, res) => {
  try { await remove('books',Number(req.params.id));res.json({success:true}); } catch(error) {sendError(res,error);}
});
router.get('/issued/:accessionNo', async (req,res) => {
  try {
    const [rows]=await db.promise().query(`SELECT i.id, s.name, s.registration_no, i.issue_date, i.due_date, i.returned, i.return_date,
      CASE WHEN i.returned=1 THEN 'Returned' WHEN i.due_date<? THEN 'Overdue' ELSE 'Issued' END status
      FROM issues i JOIN students s ON s.id=i.student_id JOIN books b ON b.id=i.book_id
      WHERE b.accession_no=? ORDER BY i.id DESC LIMIT 100`,[today(), req.params.accessionNo]);
    res.json(rows);
  } catch(error) {sendError(res,error);}
});
module.exports=router;
