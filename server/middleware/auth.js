const jwt = require("jsonwebtoken");
const config = require("../config");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized", message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const [rows] = await require('../db').promise().query('SELECT id,password_version FROM admins WHERE id=? AND email=?',[decoded.id,decoded.email]);
    if (!rows.length || Number(decoded.version || 0) !== rows[0].password_version) return res.status(401).json({error:'Your session has expired. Please sign in again.'});
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
  }
}

module.exports = { authMiddleware };
