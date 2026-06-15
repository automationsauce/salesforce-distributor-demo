const pool = require("../db/connection");

async function upsertObjectConfig(
  accountId,
  objectName,
  entryQueueId,
  requiredFields,
  enablePolling = true,
  active = true
) {
  const result = await pool.query(
    `
    INSERT INTO object_configs (
      account_id,
      object_name,
      entry_queue_id,
      required_fields,
      enable_polling,
      active,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (account_id, object_name)
    DO UPDATE SET
      entry_queue_id = EXCLUDED.entry_queue_id,
      required_fields = EXCLUDED.required_fields,
      enable_polling = EXCLUDED.enable_polling,
      active = EXCLUDED.active,
      updated_at = NOW()
    RETURNING *
    `,
    [
      accountId,
      objectName,
      entryQueueId,
      JSON.stringify(requiredFields || []),
      enablePolling,
      active
    ]
  );

  return result.rows[0];
}

async function getObjectConfigs(accountId) {
  const result = await pool.query(
    `
    SELECT *
    FROM object_configs
    WHERE account_id = $1
    AND active = TRUE
    ORDER BY object_name
    `,
    [accountId]
  );

  return result.rows;
}

module.exports = {
  upsertObjectConfig,
  getObjectConfigs
};