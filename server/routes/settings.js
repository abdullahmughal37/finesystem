const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");

const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `logo-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

function getSetting(key) {
  return new Promise((resolve) => {
    db.query("SELECT setting_value FROM settings WHERE setting_key = ?", [key], (err, rows) => {
      if (err || !rows?.length) return resolve(null);
      resolve(rows[0].setting_value);
    });
  });
}

function setSetting(key, value) {
  return new Promise((resolve, reject) => {
    db.query(
      "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [key, String(value)],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

router.get("/", (req, res) => {
  db.query("SELECT setting_key, setting_value FROM settings", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const obj = {};
    (rows || []).forEach((r) => { obj[r.setting_key] = r.setting_value; });
    res.json(obj);
  });
});

router.post("/", (req, res) => {
  const body = req.body || {};
  const keys = ["universityName", "campus", "address", "logoUrl", "maxBooks", "issueDays", "finePerDay", "reminderDays", "enable2FA"];
  Promise.all(keys.map((k) => body[k] !== undefined ? setSetting(k, body[k]) : Promise.resolve()))
    .then(() => res.json({ success: true }))
    .catch((e) => res.status(500).json({ error: e.message }));
});

router.post("/logo", upload.single("logo"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const url = `/uploads/${req.file.filename}`;
  setSetting("logoUrl", url)
    .then(() => res.json({ success: true, logoUrl: url }))
    .catch((e) => res.status(500).json({ error: e.message }));
});

module.exports = router;
