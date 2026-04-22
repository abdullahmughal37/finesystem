const express = require("express");
const router = express.Router();
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const db = require("../db"); // your mysql connection

const upload = multer({ dest: "uploads/" });

router.post("/import", upload.single("file"), (req, res) => {

  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", () => {

      const sql =
        "INSERT INTO students (rollNo,name,email,dept,semester,status,enrolled) VALUES ?";

      const values = results.map((row) => [
        row.rollNo,
        row.name,
        row.email,
        row.dept,
        row.semester,
        row.status,
        row.enrolled,
      ]);

      db.query(sql, [values], (err) => {

        fs.unlinkSync(req.file.path); // delete temp file

        if (err) {
          console.error(err);
          return res.status(500).json({ message: "Import failed" });
        }

        res.json({ message: "CSV Imported Successfully" });
      });
    });
});

module.exports = router;