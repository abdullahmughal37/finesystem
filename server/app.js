require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { authMiddleware } = require('./middleware/auth');
const db = require('./db');
const uploadDir = require('./lib/uploads');

const app = express();
const configuredOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);
const developmentOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'];
const allowedOrigins = new Set(configuredOrigins.length ? configuredOrigins : (process.env.NODE_ENV === 'production' ? [] : developmentOrigins));
app.use(cors({ origin(origin, callback) { callback(null, !origin || allowedOrigins.has(origin)); } }));
app.use(express.json({limit:'1mb'}));
app.get('/health', async (_req, res) => {
  try {
    await db.ready;
    await db.promise().query('SELECT 1');
    res.status(200).json({ status: 'healthy' });
  } catch {
    res.status(503).json({ status: 'unhealthy' });
  }
});
app.use('/api', async (req, res, next) => {
  try { await db.ready; next(); }
  catch { res.status(503).json({ error: 'Database is not ready. Contact the administrator.' }); }
});
app.use("/uploads", express.static(uploadDir));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/clearance/verify", require("./routes/clearanceVerify"));
app.use('/api', authMiddleware);
app.use('/api/settings/layouts',require('./routes/layouts'));
app.use("/api", require("./routes/issueBook"));
app.use("/api/books", require("./routes/books"));
app.use("/api/students", require("./routes/importStudents"));
app.use("/api", require("./routes/studentRoutes"));
app.use("/api/books", require("./routes/importBooks"));

app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/return", require("./routes/returnBook"));
app.use("/api/fines", require("./routes/fines"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/issued-students", require("./routes/issuedStudents"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/backup", require("./routes/backup"));
app.use("/api/reminders", require("./routes/reminders"));
app.use("/api/clearance", require("./routes/clearance"));

const frontendDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path === '/api' || req.path.startsWith('/api/') || !req.accepts('html')) return next();
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
}

module.exports = app;
