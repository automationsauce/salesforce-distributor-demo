const pool = require("../db/connection");

async function upsertAccount(accountKey, name = null) {
  const result = await pool.query(
    `
    INSERT INTO accounts (
      account_key,
      name
    )
    VALUES ($1, $2)
    ON CONFLICT (account_key)
    DO UPDATE SET
      name = EXCLUDED.name,
      updated_at = NOW()
    RETURNING *
    `,
    [accountKey, name]
  );

  return result.rows[0];
}

async function getAccount(accountKey) {
  const result = await pool.query(
    `
    SELECT *
    FROM accounts
    WHERE account_key = $1
    `,
    [accountKey]
  );

  return result.rows[0];
}

module.exports = {
  upsertAccount,
  getAccount
};