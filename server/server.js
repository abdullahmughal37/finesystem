const config = require('./config');
require('./lib/runtimeConfig').validateRuntimeConfig(config);
const app = require('./app');
const db = require('./db');
db.ready.then(() => {
  return require('./lib/adminBootstrap').ensureInitialAdmin(db.promise());
}).then(result => {
  if (result.created) console.log(`Initial administrator created: ${result.email}`);
  require('./lib/fineTrash').startFineTrashCleanup(db.promise());
  require('./lib/catalogTrash').startCatalogTrashCleanup(db.promise());
  const port = process.env.PORT || 5000;
  const server = app.listen(port, '0.0.0.0', () => console.log('Server running on port ' + port));
  const shutdown = signal => {
    console.log(`${signal} received. Closing server.`);
    server.close(() => db.end(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}).catch(error => {
  console.error('Server startup failed:', error.code || error.message);
  db.end();
  process.exitCode = 1;
});
