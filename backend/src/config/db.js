/**
 * db.js: connection pool to Supabase PostgreSQL using the `pg` driver.
 *
 * All queries use numbered parameters ($1, $2, ...). The values travel to
 * PostgreSQL separately from the SQL text, so user input can never change
 * the command. This is what prevents SQL injection.
 */
const { Pool } = require('pg');
const config = require('./env');

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,   // Supabase requires SSL
  max: 10,
});

// Show dates in Kenyan time inside SQL functions such as to_char() and now()::date
pool.on('connect', (client) => client.query("set time zone 'Africa/Nairobi'"));

/** Run one query and return all rows. */
async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

/** Run one query and return the first row (or null). */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/**
 * Run several queries as ONE all-or-nothing transaction.
 * Usage: await transaction(async (tx) => { await tx.query(...); ... });
 * If anything inside throws, every change is rolled back.
 */
async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const tx = {
      query: async (sql, params = []) => (await client.query(sql, params)).rows,
      queryOne: async (sql, params = []) => (await client.query(sql, params)).rows[0] || null,
    };
    const result = await work(tx);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, queryOne, transaction };
