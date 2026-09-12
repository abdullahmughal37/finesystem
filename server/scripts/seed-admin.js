const bcrypt = require('bcryptjs');
const db = require('../db');

async function main() {
  const name = String(process.env.ADMIN_NAME || 'Library Administrator').trim();
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  if (!name || name.length > 100) throw new Error('ADMIN_NAME is required and must be at most 100 characters.');
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) throw new Error('Set ADMIN_EMAIL to a valid email address.');
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('Set ADMIN_PASSWORD to 12-72 UTF-8 bytes.');
  await db.ready;
  const [existing] = await db.promise().query('SELECT id FROM admins WHERE email=?', [email]);
  if (existing.length) {
    console.log(`Administrator already exists: ${email}. No password was changed.`);
    return;
  }
  await db.promise().query('INSERT INTO admins(email,password_hash,name) VALUES (?,?,?)', [email, await bcrypt.hash(password, 12), name]);
  console.log(`Administrator created: ${email}`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.promise().end());
