const db = require('../db');
const { ValidationError } = require('./records');
async function transaction(fn) {
  await db.ready;
  for (let attempt = 0; ; attempt++) {
    const connection = await db.promise().getConnection();
    try {
      await connection.beginTransaction(); const result = await fn(connection); await connection.commit(); return result;
    } catch (error) {
      await connection.rollback();
      if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code) && attempt < 2) continue;
      throw error;
    } finally { connection.release(); }
  }
}
function sendError(res, error) {
  if (error instanceof ValidationError) return res.status(error.status).json({ error: error.message, message: error.message, code: error.code });
  if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This identifier already exists. Refresh and review the existing record.', code: 'conflict' });
  console.error('Request failed:', error.code || error.message);
  return res.status(500).json({ error: 'Unable to save or load data. Please try again. No success has been confirmed.' });
}
module.exports = { transaction, sendError };
