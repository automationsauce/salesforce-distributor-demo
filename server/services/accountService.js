const pool = require("../db/connection");

async function upsertAccount(accountKey, name = null, status = "ACTIVE") {
  const result = await pool.query(
    `
    INSERT INTO accounts (account_key, name, status, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (account_key)
    DO UPDATE SET
      name = EXCLUDED.name,
      status = EXCLUDED.status,
      updated_at = NOW()
    RETURNING *
    `,
    [accountKey, name, status]
  );

  return result.rows[0];
}

async function getAccountByKey(accountKey) {
  const result = await pool.query(
    `SELECT * FROM accounts WHERE account_key = $1`,
    [accountKey]
  );

  return result.rows[0] || null;
}

module.exports = {
  upsertAccount,
  getAccountByKey
};