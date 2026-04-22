const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/overdue", (req, res) => {
  const sql = `
    SELECT s.rollNo, s.name, s.email, b.title as book, br.due_date as dueDate,
      DATEDIFF(CURDATE(), br.due_date) as daysOverdue
    FROM borrow_records br
    JOIN students s ON s.rollNo = br.rollNo
    JOIN books b ON b.serial = br.serialNo
    WHERE br.status = 'issued' AND br.due_date < CURDATE()
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

router.post("/send", (req, res) => {
  db.query(`
    SELECT s.email, s.name, b.title, br.due_date
    FROM borrow_records br
    JOIN students s ON s.rollNo = br.rollNo
    JOIN books b ON b.serial = br.serialNo
    WHERE br.status = 'issued' AND br.due_date < CURDATE()
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const nodemailer = require("nodemailer");
    const config = require("../config");
    if (!config.smtp?.user) {
      return res.json({ success: true, count: 0, message: "Email not configured" });
    }
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: false,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
    let sent = 0;
    const promises = (rows || []).map((r) => {
      const html = `
        <p>Dear ${r.name},</p>
        <p>This is a reminder that your borrowed book "<strong>${r.title}</strong>" was due on ${new Date(r.due_date).toLocaleDateString()}.</p>
        <p>Please return it at your earliest convenience to avoid fines.</p>
        <p>Library Management System</p>
      `;
      return transporter.sendMail({
        from: config.smtp.user,
        to: r.email,
        subject: "Library – Overdue Book Reminder",
        html,
      }).then(() => { sent++; }).catch(() => {});
    });
    Promise.all(promises).then(() => res.json({ success: true, count: sent }));
  });
});

module.exports = router;
