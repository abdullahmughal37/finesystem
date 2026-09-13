const db = require('../db');
const { bootstrapValues, validateBootstrap } = require('../lib/adminBootstrap');
const bcrypt = require('bcryptjs');

async function main() {
  const { name, email, password } = bootstrapValues();
  validateBootstrap({ name, email, password });
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
