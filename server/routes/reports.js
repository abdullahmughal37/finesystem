const express = require("express");
const router = express.Router();
const db = require("../db");
const ExcelJS = require("exceljs");

/* Total books issued monthly */
router.get("/issued-monthly", (req, res) => {
  const sql = `
    SELECT DATE_FORMAT(issue_date, '%Y-%m') as monthKey,
      DATE_FORMAT(issue_date, '%b %Y') as month,
      COUNT(*) as count
    FROM borrow_records
    WHERE issue_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
    GROUP BY DATE_FORMAT(issue_date, '%Y-%m')
    ORDER BY monthKey
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

/* Most issued books */
router.get("/most-issued-books", (req, res) => {
  const sql = `
    SELECT b.title, b.serial, b.author, COUNT(br.id) as issueCount
    FROM borrow_records br
    JOIN books b ON b.serial = br.serialNo
    GROUP BY br.serialNo
    ORDER BY issueCount DESC
    LIMIT 10
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

/* Students with most issues */
router.get("/top-borrowers", (req, res) => {
  const sql = `
    SELECT s.rollNo, s.name, s.dept, COUNT(br.id) as borrowCount
    FROM borrow_records br
    JOIN students s ON s.rollNo = br.rollNo
    GROUP BY br.rollNo
    ORDER BY borrowCount DESC
    LIMIT 10
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

/* Total fines collected */
router.get("/fines-summary", (req, res) => {
  const sql = `
    SELECT 
      COALESCE(SUM(fine_amount), 0) as total,
      COALESCE(SUM(CASE WHEN status='sent' THEN fine_amount ELSE 0 END), 0) as collected
    FROM fines
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows[0] || { total: 0, collected: 0 });
  });
});

/* Monthly fines for chart */
router.get("/monthly-fines", (req, res) => {
  const sql = `
    SELECT DATE_FORMAT(created_at, '%b') as month,
      COALESCE(SUM(fine_amount), 0) as auto
    FROM fines
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 8 MONTH)
    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
    ORDER BY MIN(created_at)
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

/* Overdue books report */
router.get("/overdue", (req, res) => {
  const sql = `
    SELECT s.rollNo, s.name, b.title as book, s.dept,
      DATEDIFF(CURDATE(), br.due_date) as daysOverdue,
      DATEDIFF(CURDATE(), br.due_date) * 10 as fine
    FROM borrow_records br
    JOIN students s ON s.rollNo = br.rollNo
    JOIN books b ON b.serial = br.serialNo
    WHERE br.status = 'issued' AND br.due_date < CURDATE()
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

/* Overdue by department */
router.get("/overdue-by-dept", (req, res) => {
  const sql = `
    SELECT 
      SUBSTRING_INDEX(s.dept, ' ', 1) as dept,
      COUNT(*) as overdue
    FROM borrow_records br
    JOIN students s ON s.rollNo = br.rollNo
    WHERE br.status = 'issued' AND br.due_date < CURDATE()
    GROUP BY dept
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

/* Accounts office - full fines report */
router.get("/accounts-office", (req, res) => {
  const sql = `
    SELECT f.id, s.name as studentName, f.rollNo, f.serialNo as bookSerial, f.fine_amount as fineAmount,
      CONCAT(IF(f.days_late > 0, CONCAT('Overdue ', f.days_late, ' days'), 'Manual')) as fineReason,
      f.created_at as fineDate,
      CASE WHEN f.status='sent' THEN 'Paid' ELSE 'Unpaid' END as fineStatus
    FROM fines f
    LEFT JOIN students s ON s.rollNo = f.rollNo
    ORDER BY f.created_at DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

/* Export full report as Excel */
router.get("/export/excel", (req, res) => {
  const sql = `
    SELECT s.name as studentName, f.rollNo, f.serialNo as bookSerial, f.fine_amount as fineAmount,
      CONCAT(IF(f.days_late > 0, CONCAT('Overdue ', f.days_late, ' days'), 'Manual')) as fineReason,
      f.created_at as fineDate,
      CASE WHEN f.status='sent' THEN 'Paid' ELSE 'Unpaid' END as fineStatus
    FROM fines f
    LEFT JOIN students s ON s.rollNo = f.rollNo
    ORDER BY f.created_at DESC
  `;
  db.query(sql, async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const data = rows || [];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Fines Report");
    sheet.columns = [
      { header: "Student Name", key: "studentName", width: 25 },
      { header: "Roll Number", key: "rollNo", width: 18 },
      { header: "Book Serial", key: "bookSerial", width: 20 },
      { header: "Amount (PKR)", key: "fineAmount", width: 14 },
      { header: "Reason", key: "fineReason", width: 20 },
      { header: "Date", key: "fineDate", width: 14 },
      { header: "Status", key: "fineStatus", width: 12 },
    ];
    data.forEach((r) => sheet.addRow({
      studentName: r.studentName || "",
      rollNo: r.rollNo || "",
      bookSerial: r.bookSerial || "",
      fineAmount: r.fineAmount || 0,
      fineReason: r.fineReason || "",
      fineDate: r.fineDate ? new Date(r.fineDate).toLocaleDateString() : "",
      fineStatus: r.fineStatus || "",
    }));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=library-report.xlsx");
    const buffer = await workbook.xlsx.writeBuffer();
    res.send(buffer);
  });
});


/* Full analytics summary */
router.get("/analytics", (req, res) => {
  const queries = {
    totalFines: "SELECT COALESCE(SUM(fine_amount), 0) as v FROM fines",
    collectedFines: "SELECT COALESCE(SUM(CASE WHEN status='sent' THEN fine_amount ELSE 0 END), 0) as v FROM fines",
    activeOverdues: "SELECT COUNT(*) as v FROM borrow_records WHERE status='issued' AND due_date < CURDATE()",
    totalIssues: "SELECT COUNT(*) as v FROM borrow_records",
  };
  const out = {};
  let done = 0;
  const check = () => {
    done++;
    if (done === 4) res.json(out);
  };
  db.query(queries.totalFines, (e, r) => { out.totalFines = (r && r[0]?.v) || 0; check(); });
  db.query(queries.collectedFines, (e, r) => { out.collectedFines = (r && r[0]?.v) || 0; check(); });
  db.query(queries.activeOverdues, (e, r) => { out.activeOverdues = (r && r[0]?.v) || 0; check(); });
  db.query(queries.totalIssues, (e, r) => { out.totalIssues = (r && r[0]?.v) || 0; check(); });
});

module.exports = router;
