const pool = require("../db/connection");

async function deleteAgentsForDistributor(distributorId) {
  await pool.query(
    `
    DELETE FROM distributor_agents
    WHERE distributor_id = $1
    `,
    [distributorId]
  );
}

async function insertAgent(distributorId, agent) {
  const result = await pool.query(
    `
    INSERT INTO distributor_agents (
      distributor_id,
      external_user_id,
      name,
      sequence_number,
      active,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW())
    RETURNING *
    `,
    [
      distributorId,
      agent.userId,
      agent.name,
      agent.sequence,
      agent.active
    ]
  );

  return result.rows[0];
}

async function replaceAgentsForDistributor(distributorId, agents) {
  await deleteAgentsForDistributor(distributorId);

  const inserted = [];

  for (const agent of agents) {
    inserted.push(
      await insertAgent(distributorId, agent)
    );
  }

  return inserted;
}

async function getAgentsByDistributor(distributorId) {
  const result = await pool.query(
    `
    SELECT *
    FROM distributor_agents
    WHERE distributor_id = $1
    ORDER BY sequence_number ASC
    `,
    [distributorId]
  );

  return result.rows;
}

module.exports = {
  deleteAgentsForDistributor,
  insertAgent,
  replaceAgentsForDistributor,
  getAgentsByDistributor
};