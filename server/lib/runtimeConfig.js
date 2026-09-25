function validateRuntimeConfig(config) {
  const missingDatabase = [
    ['DB_HOST or MYSQLHOST', config.db.host],
    ['DB_USER or MYSQLUSER', config.db.user],
    ['DB_NAME or MYSQLDATABASE', config.db.database],
  ].filter(([, value]) => !String(value || '').trim()).map(([name]) => name);

  if (missingDatabase.length) throw new Error(`Missing database configuration: ${missingDatabase.join(', ')}.`);
  if (config.db.port && (!Number.isInteger(Number(config.db.port)) || Number(config.db.port) < 1 || Number(config.db.port) > 65535)) {
    throw new Error('Database port must be an integer from 1 to 65535.');
  }
  if (!String(config.jwt.secret || '').trim()) throw new Error('JWT_SECRET is required.');
  if (process.env.NODE_ENV === 'production' && String(config.jwt.secret).length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters in production.');
  }
  if (process.env.RECOVERY_ENCRYPTION_KEY && String(process.env.RECOVERY_ENCRYPTION_KEY).length < 32) {
    throw new Error('RECOVERY_ENCRYPTION_KEY must contain at least 32 characters when provided.');
  }
}

module.exports = { validateRuntimeConfig };
