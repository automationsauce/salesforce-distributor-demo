const pool = require("../db/connection");

async function upsertConnection(accountId, crmType, instanceURL, clientId, clientSecret, refreshToken) {
  const result = await pool.query(
    `
    INSERT INTO crm_connections (
      account_id,
      crm_type,
      instance_url,
      client_id,
      client_secret_encrypted,
      refresh_token_encrypted
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (account_id)
    DO UPDATE SET
      crm_type = EXCLUDED.crm_type,
      instance_url = EXCLUDED.instance_url,
      client_id = EXCLUDED.client_id,
      client_secret_encrypted = EXCLUDED.client_secret_encrypted,
      refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
      updated_at = NOW()
    RETURNING *
    `,
    [accountId, crmType, instanceURL, clientId, clientSecret, refreshToken]
  );

  return result.rows[0];
}

async function getConnection(accountId, crmType) {
  const result = await pool.query(
    `
    SELECT *
    FROM crm_connections
    WHERE account_id = $1
    AND crm_type = $2
    `,
    [accountId, crmType]
  );

  return result.rows[0] || null;
}

module.exports = {
  upsertConnection,
  getConnection
};
   