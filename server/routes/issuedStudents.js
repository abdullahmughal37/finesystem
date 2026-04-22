const express = require("express");
const router = express.Router();
const db = require("../db");

/* ISSUED STUDENTS LIST - for sidebar */
router.get("/", (req, res) => {
  const sql = `
    SELECT s.name, s.rollNo, br.serialNo as bookSerial, br.issue_date as issueDate, br.due_date as dueDate
    FROM borrow_records br
    JOIN students s ON s.rollNo = br.rollNo
    WHERE br.status = 'issued'
    ORDER BY br.issue_date DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

module.exports = router;
