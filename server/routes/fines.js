const express = require("express");
const router = express.Router();
const db = require("../db");

/* UNSENT FINES */
router.get("/unsent", (req, res) => {
  const sql = `
    SELECT f.*, s.name, b.title as bookTitle
    FROM fines f
    JOIN students s ON s.rollNo = f.rollNo
    LEFT JOIN books b ON b.serial = f.serialNo
    WHERE f.status = 'unsent'
    ORDER BY f.created_at DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

/* SENT FINES */
router.get("/sent", (req, res) => {
  const sql = `
    SELECT f.*, s.name, b.title as bookTitle
    FROM fines f
    JOIN students s ON s.rollNo = f.rollNo
    LEFT JOIN books b ON b.serial = f.serialNo
    WHERE f.status = 'sent'
    ORDER BY f.created_at DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

/* ALL FINES (for Fines page listing) */
router.get("/", (req, res) => {
  const sql = `
    SELECT f.id, f.rollNo, s.name, f.fine_amount as amount, 
      CONCAT('Overdue – ', f.days_late, ' days') as reason,
      'Auto' as type, 
      CASE WHEN f.status = 'sent' THEN 'Paid' ELSE 'Unpaid' END as status,
      f.created_at as date, b.title as bookTitle
    FROM fines f
    JOIN students s ON s.rollNo = f.rollNo
    LEFT JOIN books b ON b.serial = f.serialNo
    ORDER BY f.created_at DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

/* CREATE MANUAL FINE */
router.post("/create", (req, res) => {
  const { rollNo, serialNo, fine_amount } = req.body;
  if (!rollNo || fine_amount == null) {
    return res.status(400).json({ error: "rollNo and fine_amount required" });
  }
  const days_late = 0;
  const serial = serialNo || "";
  db.query(
    "SELECT id FROM students WHERE rollNo = ?",
    [rollNo],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows || rows.length === 0) return res.status(400).json({ error: "Student not found" });
      db.query(
        "INSERT INTO fines (rollNo, serialNo, days_late, fine_amount, status) VALUES (?, ?, ?, ?, 'unsent')",
        [rollNo, serial, days_late, Number(fine_amount)],
        (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ success: true });
        }
      );
    }
  );
});

/* EXPORT CSV - all fines */
router.get("/export/csv", (req, res) => {
  const sql = `
    SELECT f.id, f.rollNo, s.name, f.serialNo, f.fine_amount, f.days_late, f.status, f.created_at
    FROM fines f
    LEFT JOIN students s ON s.rollNo = f.rollNo
    ORDER BY f.created_at DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const header = "ID,Roll No,Student Name,Book Serial,Fine Amount,Days Late,Status,Date\n";
    const csv = header + (rows || []).map((r) =>
      [r.id, r.rollNo, `"${(r.name || "").replace(/"/g, '""')}"`, r.serialNo, r.fine_amount, r.days_late, r.status, r.created_at].join(",")
    ).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=fines-export.csv");
    res.send("\uFEFF" + csv);
  });
});

/* SEND TO ACCOUNT OFFICE - Excel attachment + email + mark sentToAccounts */
router.post("/send-to-account", async (req, res) => {
  const sql = `SELECT f.id, s.name as studentName, f.rollNo, f.serialNo, f.fine_amount as amount,
    CONCAT('Overdue ', f.days_late, ' days') as reason, f.created_at as date
    FROM fines f LEFT JOIN students s ON s.rollNo = f.rollNo
    WHERE f.status = 'unsent' OR (f.sentToAccounts = 0 AND f.status = 'sent')`;
  db.query(sql, async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const data = rows || [];
    if (data.length === 0) return res.json({ success: true, updated: 0, message: "No unsent fines" });

    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Fines");
    sheet.columns = [
      { header: "Student Name", key: "studentName", width: 25 },
      { header: "Roll Number", key: "rollNo", width: 18 },
      { header: "Amount", key: "amount", width: 12 },
      { header: "Reason", key: "reason", width: 20 },
      { header: "Date", key: "date", width: 15 },
    ];
    data.forEach((r) => sheet.addRow({
      studentName: r.studentName || "",
      rollNo: r.rollNo || "",
      amount: r.amount || 0,
      reason: r.reason || "",
      date: r.date ? new Date(r.date).toLocaleDateString() : "",
    }));

    const config = require("../config");
    const ids = data.map((r) => r.id);

    if (config.smtp?.user) {
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: false,
        auth: { user: config.smtp.user, pass: config.smtp.pass },
      });
      const buffer = await workbook.xlsx.writeBuffer();
      await transporter.sendMail({
        from: config.smtp.user,
        to: config.smtp.user,
        subject: "Library Fine Report",
        html: `<p>Please find attached the library fines report (${data.length} records).</p>`,
        attachments: [{ filename: "library-fines.xlsx", content: buffer }],
      }).catch((e) => console.warn("Email send failed:", e.message));
    }

    const placeholders = ids.map(() => "?").join(",");
    db.query(
      `UPDATE fines SET status = 'sent', sentToAccounts = 1 WHERE id IN (${placeholders})`,
      ids,
      (err2, result) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ success: true, updated: result?.affectedRows || 0 });
      }
    );
  });
});

/* FINE SUMMARY */
router.get("/summary", (req, res) => {
  const sql = `
    SELECT 
      COALESCE(SUM(fine_amount), 0) as total,
      COALESCE(SUM(CASE WHEN status='sent' THEN fine_amount ELSE 0 END), 0) as collected,
      COALESCE(SUM(CASE WHEN status='unsent' THEN fine_amount ELSE 0 END), 0) as pending,
      COUNT(CASE WHEN status='unsent' THEN 1 END) as unpaidCases
    FROM fines
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows[0] || { total: 0, collected: 0, pending: 0, unpaidCases: 0 });
  });
});

module.exports = router;
