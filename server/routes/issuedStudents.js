const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/", (req, res) => {
  const sql = `
    SELECT s.name, s.registration_no, b.accession_no, i.issue_date, i.due_date
    FROM issues i
    JOIN students s ON s.id = i.student_id
    JOIN books b ON b.id = i.book_id
    WHERE i.returned = 0
    ORDER BY i.issue_date DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

module.exports = router;
