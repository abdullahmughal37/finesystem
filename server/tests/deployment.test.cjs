const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateRuntimeConfig } = require('../lib/runtimeConfig');
const { ensureInitialAdmin } = require('../lib/adminBootstrap');

test('production configuration requires database values and a strong JWT secret', () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    assert.doesNotThrow(() => validateRuntimeConfig({
      db: { host: 'mysql.railway.internal', port: '3306', user: 'app', database: 'railway' },
      jwt: { secret: 'a'.repeat(32) },
    }));
    assert.throws(() => validateRuntimeConfig({ db: {}, jwt: { secret: 'a'.repeat(32) } }), /Missing database configuration/);
    assert.throws(() => validateRuntimeConfig({
      db: { host: 'mysql', port: 'invalid', user: 'app', database: 'railway' },
      jwt: { secret: 'a'.repeat(32) },
    }), /Database port/);
    assert.throws(() => validateRuntimeConfig({
      db: { host: 'mysql', port: '3306', user: 'app', database: 'railway' },
      jwt: { secret: 'too-short' },
    }), /at least 32 characters/);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test('first administrator bootstrap is idempotent', async () => {
  const previous = {
    ADMIN_NAME: process.env.ADMIN_NAME,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  };
  Object.assign(process.env, {
    ADMIN_NAME: 'Production Librarian',
    ADMIN_EMAIL: 'librarian@example.edu',
    ADMIN_PASSWORD: 'A-strong-temporary-password',
  });

  const inserts = [];
  let total = 0;
  const queryable = {
    async query(sql, values) {
      if (sql.startsWith('SELECT COUNT')) return [[{ total }]];
      if (sql.startsWith('INSERT INTO admins')) {
        total += 1;
        inserts.push(values);
        return [{ insertId: 1 }];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  try {
    const first = await ensureInitialAdmin(queryable);
    const second = await ensureInitialAdmin(queryable);
    assert.deepEqual(first, { created: true, email: 'librarian@example.edu' });
    assert.deepEqual(second, { created: false });
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0][0], 'librarian@example.edu');
    assert.notEqual(inserts[0][1], process.env.ADMIN_PASSWORD);
    assert.equal(inserts[0][2], 'Production Librarian');
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
