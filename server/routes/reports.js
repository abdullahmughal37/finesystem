const express = require("express");
const router = express.Router();
const db = require("../db");
const ExcelJS = require("exceljs");
const { today, daysLate, getPolicy, fineAmount } = require("../lib/policy");
const { sendError } = require("../lib/database");

router.get("/issued-monthly", async (req, res) => {
  try { const [rows] = await db.promise().query(`SELECT DATE_FORMAT(issue_date, '%Y-%m') as month, COUNT(*) as count
            FROM issues
            WHERE issue_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
            GROUP BY DATE_FORMAT(issue_date, '%Y-%m')
            ORDER BY MIN(issue_date)`); res.json(rows);
  } catch (error) { sendError(res, error); }
});

router.get("/monthly-fines", async (req, res) => {
  try { const [rows] = await db.promise().query(`SELECT DATE_FORMAT(created_at, '%Y-%m') as month,
              COALESCE(SUM(CASE WHEN fine_type='auto' THEN fine_amount ELSE 0 END), 0) as auto,
              COALESCE(SUM(CASE WHEN fine_type='manual' THEN fine_amount ELSE 0 END), 0) as manual
            FROM fines
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 8 MONTH)
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY MIN(created_at)`); res.json(rows);
  } catch (error) { sendError(res, error); }
});

router.get('/overdue', async (req,res) => {
  try {
    const [rows]=await db.promise().query('SELECT i.id,i.due_date,s.registration_no,s.name,b.title book,b.accession_no,s.department FROM issues i JOIN students s ON s.id=i.student_id JOIN books b ON b.id=i.book_id WHERE i.returned=0 AND i.due_date<?',[today()]);
    const policy=await getPolicy(db.promise());const date=today();
    res.json(rows.map(r=>({...r,daysOverdue:daysLate(r.due_date,date),fine:fineAmount(daysLate(r.due_date,date),policy.finePerDay)})));
  } catch(error){sendError(res,error);}
});
router.get('/overdue-by-dept',async(req,res)=>{
  try{const [rows]=await db.promise().query('SELECT s.department dept,COUNT(*) overdue FROM issues i JOIN students s ON s.id=i.student_id WHERE i.returned=0 AND i.due_date<? GROUP BY s.department',[today()]);res.json(rows);}catch(error){sendError(res,error);}
});

router.get("/accounts-office", async (req, res) => {
  const sql = `SELECT s.name as studentName, s.registration_no, b.accession_no,
      f.fine_amount as fineAmount, COALESCE(NULLIF(f.reason,''), CONCAT('Late return - ', f.days_late, ' days')) as fineReason,
      f.created_at as fineDate, CASE WHEN f.status='sent' THEN 'Sent' ELSE 'Unsent' END as fineStatus
      FROM fines f
      LEFT JOIN students s ON s.id = f.student_id
      LEFT JOIN books b ON b.id = f.book_id
      WHERE COALESCE(f.resolution_status,'pending')='pending'
      ORDER BY f.created_at DESC`;
  try { const [rows] = await db.promise().query(sql); res.json(rows); }
  catch (error) { sendError(res, error); }
});

router.get("/analytics", async (req, res) => {
  const queries = {
    totalFines: "SELECT COALESCE(SUM(fine_amount), 0) as v FROM fines WHERE COALESCE(resolution_status,'pending')='pending'",
    sentFines: "SELECT COALESCE(SUM(CASE WHEN status='sent' THEN fine_amount ELSE 0 END), 0) as v FROM fines WHERE COALESCE(resolution_status,'pending')='pending'",
    activeOverdues: "SELECT COUNT(*) as v FROM issues WHERE returned=0 AND due_date < CURDATE()",
    totalIssues: "SELECT COUNT(*) as v FROM issues",
  };
  try {
    const values = await Promise.all(Object.entries(queries).map(async ([key, sql]) => {
      const [rows] = await db.promise().query(sql);
      return [key, Number(rows[0]?.v || 0)];
    }));
    res.json(Object.fromEntries(values));
  } catch (error) { sendError(res, error); }
});

router.get("/export/excel", async (req, res) => {
  try { const [rows] = await db.promise().query(`SELECT s.name as studentName, s.registration_no, b.accession_no,
      f.fine_amount as fineAmount, COALESCE(NULLIF(f.reason,''), CONCAT('Late return - ', f.days_late, ' days')) as fineReason,
      f.created_at as fineDate, CASE WHEN f.status='sent' THEN 'Sent' ELSE 'Unsent' END as fineStatus
      FROM fines f LEFT JOIN students s ON s.id=f.student_id LEFT JOIN books b ON b.id=f.book_id
      ORDER BY f.created_at DESC`);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Fines Report");
    sheet.columns = [
      { header: "Student Name", key: "studentName", width: 25 },
      { header: "Registration No", key: "registration_no", width: 18 },
      { header: "Book Accession", key: "accession_no", width: 20 },
      { header: "Amount (PKR)", key: "fineAmount", width: 14 },
      { header: "Reason", key: "fineReason", width: 20 },
      { header: "Date", key: "fineDate", width: 14 },
      { header: "Status", key: "fineStatus", width: 12 },
    ];
    (rows || []).forEach((r) => sheet.addRow(r));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=library-report.xlsx");
    const buffer = await workbook.xlsx.writeBuffer();
    res.send(buffer);
  } catch (error) { sendError(res, error); }
});

module.exports = router;
