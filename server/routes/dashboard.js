const express = require("express");
const router = express.Router();
const db = require("../db");

/* DASHBOARD STATS - Real database data */
router.get("/stats", (req, res) => {
  const queries = {
    totalStudents: "SELECT COUNT(*) as count FROM students",
    totalBooks: "SELECT COALESCE(SUM(total), 0) as count FROM books",
    availableBooks: "SELECT COALESCE(SUM(available), 0) as count FROM books",
    issuedBooks: "SELECT COUNT(*) as count FROM borrow_records WHERE status='issued'",
    returnedBooks: "SELECT COUNT(*) as count FROM borrow_records WHERE status='returned'",
    studentsWithFines: `SELECT COUNT(*) as count FROM borrow_records 
      WHERE status='issued' AND due_date < CURDATE()`,
    totalFines: "SELECT COALESCE(SUM(fine_amount), 0) as total FROM fines",
  };

  const results = {};
  let done = 0;
  const total = Object.keys(queries).length;

  const checkDone = () => {
    done++;
    if (done === total) res.json(results);
  };

  Object.entries(queries).forEach(([key, sql]) => {
    db.query(sql, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      results[key] = rows[0]?.count ?? rows[0]?.total ?? 0;
      checkDone();
    });
  });
});

/* RECENT ISSUES - Last 6 issued */
router.get("/recent-issues", (req, res) => {
  const sql = `
    SELECT br.rollNo, s.name, b.title as book, br.issue_date, br.due_date,
      CASE WHEN br.due_date < CURDATE() THEN 'Overdue' ELSE 'Active' END as status
    FROM borrow_records br
    JOIN students s ON s.rollNo = br.rollNo
    JOIN books b ON b.serial = br.serialNo
    WHERE br.status = 'issued'
    ORDER BY br.issue_date DESC
    LIMIT 6
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

/* OVERDUE BOOKS */
router.get("/overdue", (req, res) => {
  const sql = `
    SELECT s.rollNo as id, s.name, b.title as book,
      DATEDIFF(CURDATE(), br.due_date) as daysOverdue,
      DATEDIFF(CURDATE(), br.due_date) * 10 as fine
    FROM borrow_records br
    JOIN students s ON s.rollNo = br.rollNo
    JOIN books b ON b.serial = br.serialNo
    WHERE br.status = 'issued' AND br.due_date < CURDATE() AND br.return_date IS NULL
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

/* RECENT FINE ACTIVITY */
router.get("/recent-fines", (req, res) => {
  const sql = `
    SELECT f.id, s.rollNo as id2, s.name, f.fine_amount as amount, 
      CONCAT('Overdue Return – ', f.days_late, ' days') as reason, 
      'Auto' as type, f.status
    FROM fines f
    JOIN students s ON s.rollNo = f.rollNo
    ORDER BY f.created_at DESC
    LIMIT 5
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const mapped = (rows || []).map((r) => ({
      id: r.id2,
      name: r.name,
      amount: `PKR ${r.amount}`,
      reason: r.reason,
      type: r.type,
      status: r.status === "sent" ? "Paid" : "Unpaid",
    }));
    res.json(mapped);
  });
});

/* MONTHLY TRENDS - for charts */
router.get("/monthly-trends", (req, res) => {
  const sql = `
    SELECT 
      DATE_FORMAT(issue_date, '%b') as month,
      COUNT(*) as issued
    FROM borrow_records
    WHERE issue_date >= DATE_SUB(CURDATE(), INTERVAL 8 MONTH)
    GROUP BY DATE_FORMAT(issue_date, '%Y-%m')
    ORDER BY MIN(issue_date)
  `;
  db.query(sql, (err, issuedRows) => {
    if (err) return res.status(500).json({ error: err.message });
    const returnedSql = `
      SELECT DATE_FORMAT(return_date, '%b') as month, COUNT(*) as returned
      FROM borrow_records
      WHERE return_date IS NOT NULL AND return_date >= DATE_SUB(CURDATE(), INTERVAL 8 MONTH)
      GROUP BY DATE_FORMAT(return_date, '%Y-%m')
      ORDER BY MIN(return_date)
    `;
    db.query(returnedSql, (err2, returnedRows) => {
      if (err2) return res.status(500).json({ error: err2.message });
      const finesSql = `
        SELECT DATE_FORMAT(created_at, '%b') as month, COALESCE(SUM(fine_amount), 0) as fines
        FROM fines
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 8 MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY MIN(created_at)
      `;
      db.query(finesSql, (err3, finesRows) => {
        if (err3) return res.status(500).json({ error: err3.message });
        const byMonth = {};
        [...(issuedRows || []), ...(returnedRows || []), ...(finesRows || [])].forEach((r) => {
          if (!byMonth[r.month]) byMonth[r.month] = { month: r.month, issued: 0, returned: 0, fines: 0 };
          if (r.issued != null) byMonth[r.month].issued = r.issued;
          if (r.returned != null) byMonth[r.month].returned = r.returned;
          if (r.fines != null) byMonth[r.month].fines = Number(r.fines);
        });
        res.json(Object.values(byMonth).sort((a, b) => {
          const m = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
          return (m[a.month] || 0) - (m[b.month] || 0);
        }));
      });
    });
  });
});

module.exports = router;
