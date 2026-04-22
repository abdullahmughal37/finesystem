const express = require("express");
const router = express.Router();
const db = require("../db");


// GET ALL BOOKS (issued = active issues, available = total - issued, never negative)
router.get("/", (req, res) => {
  const sql = `
    SELECT b.id, b.title, b.author, b.isbn, b.serial, b.category, b.total,
      GREATEST(0, COALESCE(SUM(CASE WHEN br.status='issued' THEN 1 ELSE 0 END), 0)) AS issuedCount
    FROM books b
    LEFT JOIN borrow_records br ON b.serial = br.serialNo
    GROUP BY b.id, b.serial, b.title, b.author, b.isbn, b.category, b.total
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    const rows = (result || []).map((r) => {
      const issued = Math.max(0, Number(r.issuedCount) || 0);
      const total = Math.max(0, Number(r.total) || 0);
      const available = Math.max(0, total - issued);
      return { ...r, issuedCount: issued, available, total };
    });
    res.json(rows);
  });
});


// ADD BOOK
router.post("/", (req, res) => {

  const { title, author, isbn, serial, category, total } = req.body;

  const available = total;

  const sql =
    "INSERT INTO books (title,author,isbn,serial,category,total,available) VALUES (?,?,?,?,?,?,?)";

  db.query(
    sql,
    [title, author, isbn, serial, category, total, available],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Book Added" });
    }
  );

});


// DELETE BOOK
router.delete("/:id", (req, res) => {

  const { id } = req.params;

  db.query("DELETE FROM books WHERE id=?", [id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Book Deleted" });
  });

});


// GET book by serial (for lookup)
router.get("/books/:serialNo", (req, res) => {
  const { serialNo } = req.params;
  db.query("SELECT * FROM books WHERE serial = ?", [serialNo], (err, result) => {
    if (err) return res.status(500).json(err);
    if (!result || result.length === 0) return res.json({ found: false });
    res.json({ found: true, book: result[0] });
  });
});

// GET issued students for a book serial (View Issued)
router.get("/issued/:serialNo", (req, res) => {
  const { serialNo } = req.params;
  const sql = `
    SELECT s.name, s.rollNo, br.issue_date as issue_date
    FROM borrow_records br
    JOIN students s ON s.rollNo = br.rollNo
    WHERE br.serialNo = ? AND br.status = 'issued'
  `;
  db.query(sql, [serialNo], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result || []);
  });
});





module.exports = router;