require("dotenv").config();

module.exports = {
  db: {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "library_db",
  },
  jwt: {
    secret: process.env.JWT_SECRET || "library-jwt-secret-change-in-prod",
    expiresIn: process.env.JWT_EXPIRE || "7d",
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  rateLimit: {
    maxAttempts: 5,
    lockoutMinutes: 15,
  },
};
