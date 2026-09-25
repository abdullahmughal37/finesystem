require("dotenv").config({ path: require("path").join(__dirname, ".env") });

module.exports = {
  db: {
    host: process.env.DB_HOST || process.env.MYSQLHOST,
    user: process.env.DB_USER || process.env.MYSQLUSER,
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD,
    database: process.env.DB_NAME || process.env.MYSQLDATABASE,
    port: process.env.DB_PORT || process.env.MYSQLPORT,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRE || "7d",
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  rateLimit: {
    maxAttempts: Math.max(3, Number.parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10)),
    lockoutMinutes: Math.max(5, Number.parseInt(process.env.LOGIN_LOCKOUT_MINUTES || '15', 10)),
  },
};
