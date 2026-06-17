const { getAccount } = require("./accountService");
const { getConnection } = require("./crmConnectionService");
const { getObjectConfigs } = require("./objectConfigService");
const { getDistributors } = require("./distributorService");

const pool = require("../db/connection");

async function getAllCriteriaForAccount(accountDbId) {
  const result = await pool.query(
    `
    SELECT
      dc.*,
      d.external_id AS distributor_external_id
    FROM distributor_criteria dc
    JOIN distributors d ON d.id = dc.distributor_id
    WHERE d.account_id = $1
    ORDER BY dc.sequence_number ASC
    `,
    [accountDbId]
  );

  return result.rows;
}

async function getAllAgentsForAccount(accountDbId) {
  const result = await pool.query(
    `
    SELECT
      da.*,
      d.external_id AS distributor_external_id
    FROM distributor_agents da
    JOIN distributors d ON d.id = da.distributor_id
    WHERE d.account_id = $1
    ORDER BY da.sequence_number ASC
    `,
    [accountDbId]
  );

  return result.rows;
}

async function loadAccount(accountKey) {
  const account = await getAccount(accountKey);

  if (!account) {
    return null;
  }

  const connection = await getConnection(account.id, "salesforce");
  const objectConfigs = await getObjectConfigs(account.id);
  const distributors = await getDistributors(account.id);
  const criteria = await getAllCriteriaForAccount(account.id);
  const agents = await getAllAgentsForAccount(account.id);

  return {
    settings: {
      accountId: account.account_key,
      enablePolling: true
    },

    salesforceConnection: {
      instanceUrl: connection.instance_url,
      clientId: connection.client_id,
      clientSecret: connection.client_secret_encrypted,
      refreshToken: connection.refresh_token_encrypted
    },

    objectConfigs: objectConfigs.map(cfg => ({
      objectApiName: cfg.object_name,
      entryQueueId: cfg.entry_queue_id,
      requiredFields: cfg.required_fields || ["Id", "OwnerId"]
    })),

    distributors: distributors.map(d => ({
      id: d.external_id,
      dbId: d.id,
      name: d.name,
      sObject: null,
      logic: d.logic,
      priority: d.priority,
      nextAgent: d.next_agent_sequence,
      active: d.active
    })),

    criteria: criteria.map(c => ({
      id: c.id,
      distributionId: c.distributor_external_id,
      sequence: c.sequence_number,
      field: c.field_name,
      operator: c.operator,
      value: c.comparison_value
    })),

    agents: agents.map(a => ({
      id: a.id,
      distributionId: a.distributor_external_id,
      userId: a.external_user_id,
      name: a.name,
      sequence: a.sequence_number,
      active: a.active
    }))
  };
}

module.exports = {
  loadAccount
};