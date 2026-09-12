const RETENTION_DAYS = 90;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function purgeExpiredFines(queryable) {
  const [result] = await queryable.query('DELETE FROM fine_deletions WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP');
  return Number(result.affectedRows || 0);
}

function startFineTrashCleanup(queryable) {
  const timer = setInterval(() => {
    purgeExpiredFines(queryable).catch(error => console.error('Fine trash cleanup failed:', error.code || error.message));
  }, CLEANUP_INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = { RETENTION_DAYS, purgeExpiredFines, startFineTrashCleanup };
