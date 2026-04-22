const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/recent-fines", (req, res) => {
  const sql = `
    SELECT rollNo, serialNo, fine_amount, created_at
    FROM fines
    ORDER BY created_at DESC
    LIMIT 5
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

module.exports = router;
