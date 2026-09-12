const app = require('./app');
const db = require('./db');
db.ready.then(() => {
  require('./lib/fineTrash').startFineTrashCleanup(db.promise());
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log('Server running on port ' + port));
}).catch(() => { db.end(); process.exitCode = 1; });
