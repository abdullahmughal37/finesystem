const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const config = require("../config");
const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts. Try again later." },
});

router.post("/login", loginLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const emailNorm = String(email).trim().toLowerCase();

  db.query(
    "SELECT * FROM admins WHERE email = ?",
    [emailNorm],
    async (err, rows) => {
      if (err) return res.status(500).json({ error: "Server error" });
      if (!rows || rows.length === 0) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const admin = rows[0];

      if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
        return res.status(423).json({
          error: "Account temporarily locked",
          message: "Too many failed attempts. Try again later.",
        });
      }

      const valid = await bcrypt.compare(password, admin.password_hash);
      if (!valid) {
        const failed = (admin.failed_attempts || 0) + 1;
        const maxAttempts = config.rateLimit.maxAttempts;
        const lockoutMinutes = config.rateLimit.lockoutMinutes;
        const lockedUntil = failed >= maxAttempts
          ? new Date(Date.now() + lockoutMinutes * 60 * 1000)
          : null;

        db.query(
          "UPDATE admins SET failed_attempts = ?, locked_until = ? WHERE id = ?",
          [failed, lockedUntil, admin.id],
          () => {}
        );

        return res.status(401).json({
          error: "Invalid email or password",
          attemptsLeft: Math.max(0, maxAttempts - failed),
          locked: failed >= maxAttempts,
        });
      }

      db.query("UPDATE admins SET failed_attempts = 0, locked_until = NULL WHERE id = ?", [admin.id], () => {});

      const token = jwt.sign(
        { id: admin.id, email: admin.email },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      res.json({
        success: true,
        token,
        user: { id: admin.id, email: admin.email, name: admin.name },
      });
    }
  );
});

module.exports = router;
