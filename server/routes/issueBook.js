const express = require("express");
const router = express.Router();
const db = require("../db");

/* VERIFY STUDENT */
router.get("/student/:rollNo", (req, res) => {

  const { rollNo } = req.params;

  const sql = `
  SELECT s.*, COUNT(br.id) AS issued
  FROM students s
  LEFT JOIN borrow_records br
  ON s.rollNo = br.rollNo AND br.status = 'issued'
  WHERE s.rollNo = ?
  GROUP BY s.rollNo
  `;

  db.query(sql, [rollNo], (err, result) => {

    if (err) return res.status(500).json(err);

    if (result.length === 0) {
      return res.json({ found: false });
    }

    res.json({
      found: true,
      student: result[0]
    });

  });

});


/* VERIFY BOOK - available = total - active issued count */
router.get("/book/:serialNo", (req, res) => {
  const { serialNo } = req.params;
  db.query(
    `SELECT b.*, COALESCE((SELECT COUNT(*) FROM borrow_records WHERE serialNo = b.serial AND status = 'issued'), 0) AS issuedCount
     FROM books b WHERE b.serial = ?`,
    [serialNo],
    (err, result) => {
      if (err) return res.status(500).json(err);
      if (!result || result.length === 0) return res.json({ found: false });
      const r = result[0];
      const total = Number(r.total) || 0;
      const issued = Math.max(0, Number(r.issuedCount) || 0);
      const available = Math.max(0, total - issued);
      res.json({ found: true, book: { ...r, available, issuedCount: issued } });
    }
  );
});


/* ISSUE BOOK */
router.post("/issue", (req, res) => {
  const { rollNo, serialNo, issueDate, dueDate } = req.body;
  if (!rollNo || !serialNo) return res.status(400).json({ message: "Missing data" });

  db.query("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('maxBooks','issueDays')", (errSet, setRows) => {
    if (errSet) return res.status(500).json({ message: "Database error" });
    const kv = (setRows || []).reduce((a, r) => { a[r.setting_key] = r.setting_value; return a; }, {});
    const maxBooks = parseInt(kv.maxBooks, 10) || 3;
    const issueDays = parseInt(kv.issueDays, 10) || 15;

    db.query("SELECT id FROM students WHERE rollNo = ?", [rollNo], (errSt, stRows) => {
      if (errSt) return res.status(500).json({ message: "Database error" });
      if (!stRows || stRows.length === 0) return res.json({ message: "Student not found. Invalid Roll No." });

      db.query("SELECT id FROM books WHERE serial = ?", [serialNo], (errBk, bkRows) => {
        if (errBk) return res.status(500).json({ message: "Database error" });
        if (!bkRows || bkRows.length === 0) return res.json({ message: "Book not found. Invalid serial." });

        db.query("SELECT COUNT(*) AS total FROM borrow_records WHERE rollNo=? AND status='issued'", [rollNo], (err, result) => {
          if (err) return res.status(500).json(err);
          if ((result?.[0]?.total || 0) >= maxBooks) {
            return res.json({ message: `Student already has ${maxBooks} books issued` });
          }

          db.query("SELECT available FROM books WHERE serial = ?", [serialNo], (errCheck, bookResult) => {
            if (errCheck) return res.status(500).json(errCheck);
            if (!bookResult || bookResult.length === 0) return res.json({ message: "Book not found" });
            if ((bookResult[0].available || 0) <= 0) return res.json({ message: "Book not available" });

            const due = dueDate || (() => { const d = new Date(issueDate || new Date()); d.setDate(d.getDate() + issueDays); return d.toISOString().split("T")[0]; })();
            db.query(
              "INSERT INTO borrow_records (rollNo, serialNo, issue_date, due_date, status) VALUES (?,?,?,?,?)",
              [rollNo, serialNo, issueDate || new Date().toISOString().split("T")[0], due, "issued"],
              (err2) => {
                if (err2) return res.status(500).json({ message: "Database insert error" });
                db.query("UPDATE books SET available = available - 1 WHERE serial = ?", [serialNo], (err3) => {
                  if (err3) return res.status(500).json({ message: "Book update error" });
                  res.json({ message: "Book Issued Successfully" });
                });
              }
            );
          });
        });
      });
    });
  });
});

module.exports = router;