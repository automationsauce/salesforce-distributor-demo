const pool = require("../db/connection");

async function deleteCriteriaForDistributor(distributorId) {
  await pool.query(
    `
    DELETE FROM distributor_criteria
    WHERE distributor_id = $1
    `,
    [distributorId]
  );
}

async function insertCriteria(distributorId, criterion) {
  const result = await pool.query(
    `
    INSERT INTO distributor_criteria (
      distributor_id,
      sequence_number,
      field_name,
      operator,
      comparison_value,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW())
    RETURNING *
    `,
    [
      distributorId,
      criterion.sequence,
      criterion.field,
      criterion.operator,
      criterion.value
    ]
  );

  return result.rows[0];
}

async function replaceCriteriaForDistributor(distributorId, criteria) {
  await deleteCriteriaForDistributor(distributorId);

  const inserted = [];

  for (const criterion of criteria) {
    inserted.push(
      await insertCriteria(distributorId, criterion)
    );
  }

  return inserted;
}

async function getCriteriaByDistributor(distributorId) {
  const result = await pool.query(
    `
    SELECT *
    FROM distributor_criteria
    WHERE distributor_id = $1
    ORDER BY sequence_number ASC
    `,
    [distributorId]
  );

  return result.rows;
}

module.exports = {
  deleteCriteriaForDistributor,
  insertCriteria,
  replaceCriteriaForDistributor,
  getCriteriaByDistributor
};