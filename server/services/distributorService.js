const pool = require("../db/connection");

async function upsertDistributor(
  accountId,
  objectConfigId,
  distributor
) {
  const result = await pool.query(
    `
    INSERT INTO distributors (
      account_id,
      object_config_id,
      external_id,
      name,
      logic,
      priority,
      next_agent_sequence,
      active,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (external_id)
    DO UPDATE SET
      object_config_id = EXCLUDED.object_config_id,
      name = EXCLUDED.name,
      logic = EXCLUDED.logic,
      priority = EXCLUDED.priority,
      next_agent_sequence = EXCLUDED.next_agent_sequence,
      active = EXCLUDED.active,
      updated_at = NOW()
    RETURNING *
    `,
    [
      accountId,
      objectConfigId,
      distributor.id,
      distributor.name,
      distributor.logic,
      distributor.priority,
      distributor.nextAgent ? Number(distributor.nextAgent) : null,
      distributor.active
    ]
  );

  return result.rows[0];
}

async function getDistributors(accountId) {
  const result = await pool.query(
    `
    SELECT *
    FROM distributors
    WHERE account_id = $1
    AND active = TRUE
    ORDER BY priority ASC
    `,
    [accountId]
  );

  return result.rows;
}

module.exports = {
  upsertDistributor,
  getDistributors
};