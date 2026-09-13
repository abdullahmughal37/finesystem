const express = require("express");
const router = express.Router();
const multer = require("multer");
const crypto = require('crypto');
const db = require("../db");
const { transaction, sendError } = require("../lib/database");
const { policyFromRows } = require("../lib/policy");
const { authMiddleware } = require('../middleware/auth');

const uploadDir = require('../lib/uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const extensions = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };
    cb(null, `logo-${crypto.randomUUID()}${extensions[file.mimetype]}`);
  },
});
const allowedLogoTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024, files: 1 }, fileFilter: (req,file,cb)=>cb(allowedLogoTypes.has(file.mimetype)?null:new Error('Use a PNG, JPEG, WebP, or GIF logo.'),allowedLogoTypes.has(file.mimetype)) });

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

router.post('/', authMiddleware, async (req,res) => {
  const body=req.body||{};
  const keys=['universityName','campus','address','logoUrl','maxBooks','issueDays','finePerDay','reminderDays','enable2FA'];
  try {
    await transaction(async connection=>{
      const [rows]=await connection.query('SELECT setting_key,setting_value FROM settings FOR UPDATE');
      const merged={...Object.fromEntries(rows.map(r=>[r.setting_key,r.setting_value])),...body};
      policyFromRows(Object.entries(merged).map(([setting_key,setting_value])=>({setting_key,setting_value})));
      for(const key of keys)if(body[key]!==undefined)await connection.query('INSERT INTO settings (setting_key,setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)',[key,String(body[key])]);
    });res.json({success:true});
  }catch(error){sendError(res,error);}
});

router.post("/logo", authMiddleware, (req, res) => upload.single('logo')(req,res,error => {
  if (error) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Logo must be 2 MB or smaller.' : error.message });
  if (!req.file) return res.status(400).json({ error: "Choose a logo image." });
  const url = `/uploads/${req.file.filename}`;
  setSetting("logoUrl", url).then(() => res.json({ success: true, logoUrl: url })).catch(() => res.status(500).json({ error: 'Unable to save the logo.' }));
}));

module.exports = router;
