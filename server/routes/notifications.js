const express = require("express");
const router = express.Router();
const db = require("../db");
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get("/recent-fines", (req, res) => {
  const sql = `
    SELECT f.id, s.registration_no AS registrationNo, b.accession_no AS accessionNo,
      f.fine_amount AS fineAmount, f.created_at AS createdAt
    FROM fines f
    LEFT JOIN students s ON s.id = f.student_id
    LEFT JOIN books b ON b.id = f.book_id
    WHERE COALESCE(f.resolution_status,'pending')='pending'
    ORDER BY created_at DESC
    LIMIT 5
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

module.exports = router;
