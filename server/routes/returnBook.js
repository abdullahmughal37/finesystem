const express = require("express");
const router = express.Router();
const db = require("../db");

function getFinePerDay(cb) {
  db.query("SELECT setting_value FROM settings WHERE setting_key = 'finePerDay'", (err, rows) => {
    const val = rows?.[0]?.setting_value;
    cb(parseInt(val, 10) || 10);
  });
}

/* SEARCH by rollNo OR serialNo - returns ALL active issue records */
router.get("/search", (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) return res.status(400).json({ error: "Query required" });
  const key = q.trim();

  const sql = `
    SELECT s.rollNo, s.name as studentName, s.dept, b.title as bookTitle, b.serial as bookSerial,
      br.issue_date as issueDate, br.due_date as dueDate, br.id as recordId
    FROM borrow_records br
    JOIN students s ON s.rollNo = br.rollNo
    JOIN books b ON b.serial = br.serialNo
    WHERE br.status = 'issued' AND (br.rollNo = ? OR br.serialNo = ?)
    ORDER BY br.issue_date ASC
  `;
  // NOTE: LIMIT 1 removed — now returns ALL active records for this student/serial

  db.query(sql, [key, key], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows || rows.length === 0) return res.json({ found: false });

    getFinePerDay((finePerDay) => {
      const today = new Date();
      const records = rows.map((r) => {
        const due = new Date(r.dueDate);
        const daysPassed = Math.floor((today - due) / (1000 * 60 * 60 * 24));
        const daysLate = Math.max(0, daysPassed);
        // Format dates as readable strings so frontend doesn't get raw MySQL date objects
        const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-PK") : "";
        return {
          rollNo: r.rollNo,
          studentName: r.studentName,
          dept: r.dept,
          bookTitle: r.bookTitle,
          bookSerial: r.bookSerial,
          issueDate: formatDate(r.issueDate),
          dueDate: formatDate(r.dueDate),
          recordId: r.recordId,
          daysPassed,
          daysLate,
          fineAmount: daysLate * finePerDay,
        };
      });

      res.json({ found: true, records });
    });
  });
});

/* RETURN BOOK */
router.post("/return", (req, res) => {
  const { recordId } = req.body;
  if (!recordId) return res.status(400).json({ error: "recordId required" });

  db.query(
    "SELECT * FROM borrow_records WHERE id = ? AND status = 'issued'",
    [recordId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows || rows.length === 0)
        return res.status(400).json({ error: "Record not found or already returned" });

      const rec = rows[0];
      const due = new Date(rec.due_date);
      const today = new Date();
      const daysLate = Math.max(0, Math.floor((today - due) / (1000 * 60 * 60 * 24)));

      getFinePerDay((finePerDay) => {
        const fineAmount = daysLate * finePerDay;

        db.query(
          "UPDATE borrow_records SET return_date = CURDATE(), status = 'returned' WHERE id = ?",
          [recordId],
          (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });

            db.query(
              "UPDATE books SET available = available + 1 WHERE serial = ?",
              [rec.serialNo],
              (err3) => {
                if (err3) return res.status(500).json({ error: err3.message });

                if (daysLate > 0) {
                  db.query(
                    "INSERT INTO fines (rollNo, serialNo, days_late, fine_amount, status) VALUES (?, ?, ?, ?, 'unsent')",
                    [rec.rollNo, rec.serialNo, daysLate, fineAmount],
                    () => {
                      res.json({ success: true, fineGenerated: true, fineAmount });
                    }
                  );
                } else {
                  res.json({ success: true, fineGenerated: false, fineAmount: 0 });
                }
              }
            );
          }
        );
      });
    }
  );
});

module.exports = router;