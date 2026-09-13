const bcrypt = require('bcryptjs');

function bootstrapValues() {
  return {
    name: String(process.env.ADMIN_NAME || 'Library Administrator').trim(),
    email: String(process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
    password: String(process.env.ADMIN_PASSWORD || ''),
  };
}

function validateBootstrap({ name, email, password }) {
  if (!name || name.length > 100) throw new Error('ADMIN_NAME is required and must be at most 100 characters.');
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) throw new Error('Set ADMIN_EMAIL to a valid email address.');
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('Set ADMIN_PASSWORD to 12-72 UTF-8 bytes.');
}

async function ensureInitialAdmin(queryable) {
  const [countRows] = await queryable.query('SELECT COUNT(*) AS total FROM admins');
  if (Number(countRows[0]?.total || 0) > 0) return { created: false };

  const values = bootstrapValues();
  validateBootstrap(values);
  await queryable.query(
    'INSERT INTO admins(email,password_hash,name) VALUES (?,?,?)',
    [values.email, await bcrypt.hash(values.password, 12), values.name],
  );
  return { created: true, email: values.email };
}

module.exports = { bootstrapValues, validateBootstrap, ensureInitialAdmin };
