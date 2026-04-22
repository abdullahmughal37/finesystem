const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/sql", (req, res) => {
  const tables = ["students", "books", "borrow_records", "fines"];
  let output = `-- Library DB Backup\n-- Generated ${new Date().toISOString()}\n\n`;
  let done = 0;

  const next = (table, rows) => {
    if (!rows || rows.length === 0) { done++; check(); return; }
    const cols = Object.keys(rows[0]);
    output += `\n-- Table: ${table}\n`;
    rows.forEach((r) => {
      const vals = cols.map((c) => {
        const v = r[c];
        if (v === null) return "NULL";
        if (typeof v === "number") return v;
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      output += `INSERT INTO ${table} (${cols.join(",")}) VALUES (${vals.join(",")});\n`;
    });
    output += "\n";
    done++;
    check();
  };

  const check = () => {
    if (done >= tables.length) {
      res.setHeader("Content-Type", "application/sql");
      res.setHeader("Content-Disposition", "attachment; filename=library_db_backup.sql");
      res.send(output);
    }
  };

  tables.forEach((t) => {
    db.query(`SELECT * FROM ${t}`, (err, rows) => {
      if (err) { done++; check(); return; }
      next(t, rows || []);
    });
  });
});

router.get("/students.csv", (req, res) => {
  db.query("SELECT * FROM students", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const cols = ["id", "rollNo", "name", "email", "dept", "semester", "status", "enrolled"];
    const header = cols.join(",") + "\n";
    const csv = header + (rows || []).map((r) => cols.map((c) => `"${String(r[c] || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=students.csv");
    res.send("\uFEFF" + csv);
  });
});

router.get("/books.csv", (req, res) => {
  db.query("SELECT * FROM books", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const cols = ["id", "title", "author", "isbn", "serial", "category", "total", "available"];
    const header = cols.join(",") + "\n";
    const csv = header + (rows || []).map((r) => cols.map((c) => `"${String(r[c] || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=books.csv");
    res.send("\uFEFF" + csv);
  });
});

router.post("/delete-all", (req, res) => {
  const tables = ["fines", "borrow_records", "books", "students"];
  let i = 0;
  const next = () => {
    if (i >= tables.length) return res.json({ success: true });
    const t = tables[i++];
    db.query(`DELETE FROM ${t}`, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.query(`ALTER TABLE ${t} AUTO_INCREMENT = 1`, () => next());
    });
  };
  next();
});

module.exports = router;
