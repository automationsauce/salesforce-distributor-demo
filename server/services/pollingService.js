const {
  evaluateCriterion,
  evaluateLogic
} = require("./logicService");

const {
  querySalesforce,
  updateOwner,
  updateDistributorNextAgent
} = require("../crm/salesforce/salesforceService");

const {
  getNextAgentForDistributor
} = require("./assignmentService");

async function pollAccount(account) {
  const results = [];

  for (const config of account.objectConfigs || []) {
    if (!config.entryQueueId) {
      results.push({
        object: config.objectApiName,
        skipped: true,
        reason: "Missing entryQueueId"
      });
      continue;
    }

    const fields = config.requiredFields || ["Id", "OwnerId"];

    const soql = `
      SELECT ${fields.join(",")}
      FROM ${config.objectApiName}
      WHERE OwnerId = '${config.entryQueueId}'
      LIMIT 50
    `;

    console.log("SOQL:", soql);

    const records = await querySalesforce(account, soql);

    console.log("Salesforce response:", JSON.stringify(records, null, 2));

    if (!records.records || records.records.length === 0) {
      results.push({
        object: config.objectApiName,
        recordsFound: 0,
        soql
      });
      continue;
    }

const assignments = [];

for (const record of records.records) {
  let matched = false;

  const sortedDistributors = [...(account.distributors || [])]
    .filter(distributor => distributor.active === true)
    .sort((a, b) => Number(a.priority || 999) - Number(b.priority || 999));

  for (const distributor of sortedDistributors) {
    const relatedCriteria = (account.criteria || [])
      .filter(c => c.distributionId === distributor.id);

    const criteriaResults = {};

    for (const criterion of relatedCriteria) {
      criteriaResults[criterion.sequence] = evaluateCriterion(record, criterion);
    }

    const logicMatched = evaluateLogic(distributor.logic, criteriaResults);

    if (logicMatched) {
      const { agent, nextAgentSequence } =
        getNextAgentForDistributor(account, distributor);

      if (agent) {
        assignments.push({
          recordId: record.Id,
          ownerId: agent.userId,
          matchedDistributorId: distributor.id,
          reason: `Matched ${distributor.name}`
        });

        await updateDistributorNextAgent(
          account,
          distributor.id,
          nextAgentSequence
        );
      }

      matched = true;
      break;
    }
  }

  if (!matched) {
    assignments.push({
      recordId: record.Id,
      ownerId: record.OwnerId,
      matchedDistributorId: null,
      reason: "No distributor matched"
    });
  }
}

for (const assignment of assignments) {
  if (assignment.ownerId && assignment.ownerId !== config.entryQueueId) {
    await updateOwner(
      account,
      config.objectApiName,
      assignment.recordId,
      assignment.ownerId
    );
  }
}

    results.push({
      object: config.objectApiName,
      recordsFound: records.records.length,
      assignments
    });
  }

  return results;
}

module.exports = {
  pollAccount
};