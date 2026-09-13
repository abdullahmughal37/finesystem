const { test } = require('node:test');
const assert = require('node:assert/strict');

test('production server serves SPA routes and protects business APIs', async () => {
  Object.assign(process.env, {
    SKIP_DB_INIT: '1',
    NODE_ENV: 'production',
    DB_HOST: '127.0.0.1',
    DB_PORT: '9',
    DB_USER: 'smoke',
    DB_NAME: 'smoke',
    JWT_SECRET: 'production-smoke-secret-32-characters',
  });

  const app = require('../app');
  const db = require('../db');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    for (const route of ['/', '/students', '/verify/LIB-CLR-TEST']) {
      const response = await fetch(base + route, { headers: { Accept: 'text/html' } });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') || '', /text\/html/);
      assert.match(await response.text(), /<div id="root"><\/div>/);
    }
    const protectedResponse = await fetch(base + '/api/dashboard/stats');
    assert.equal(protectedResponse.status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await db.promise().end();
  }
});
