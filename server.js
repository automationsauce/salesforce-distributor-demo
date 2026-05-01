const express = require("express");
const app = express();

app.use(express.json());

let distributorConfig = {
  distributors: [],
  criteria: [],
  agents: []
};

app.get("/", (req, res) => {
  res.send("Salesforce Distributor Demo is running");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

function evaluateCriterion(record, criterion) {
  const recordValue = record[criterion.field];
  const targetValue = criterion.value;

  switch (criterion.operator) {
    case "=":
      return String(recordValue) === String(targetValue);
    case "!=":
      return String(recordValue) !== String(targetValue);
    case ">":
      return Number(recordValue) > Number(targetValue);
    case "<":
      return Number(recordValue) < Number(targetValue);
    case ">=":
      return Number(recordValue) >= Number(targetValue);
    case "<=":
      return Number(recordValue) <= Number(targetValue);
    default:
      return false;
  }
}

function evaluateLogic(logic, results) {
  let expression = logic || "";

  for (const sequence in results) {
    expression = expression.replaceAll(sequence, String(results[sequence]));
  }

  expression = expression
    .replaceAll("AND", "&&")
    .replaceAll("OR", "||");

  return Function(`return (${expression});`)();
}

function getNextAgent(distributorId) {
  const relatedAgents = distributorConfig.agents
    .filter(agent => agent.distributionId === distributorId && agent.active === true)
    .sort((a, b) => Number(a.sequence) - Number(b.sequence));

  return relatedAgents[0] || null;
}

// Sync Distribution Data
app.post("/sync", (req, res) => {
  distributorConfig = req.body;

  console.log("SYNC HIT");
  console.log(JSON.stringify(distributorConfig, null, 2));

  res.json({
    success: true,
    message: "Metadata synced",
    distributorCount: distributorConfig.distributors?.length || 0,
    criteriaCount: distributorConfig.criteria?.length || 0,
    agentCount: distributorConfig.agents?.length || 0
  });
});

// Assign Records Logic
app.post("/assign-bulk", (req, res) => {
  const records = req.body.records || [];
  const assignments = [];

  for (const record of records) {
    let matched = false;

    const sortedDistributors = [...(distributorConfig.distributors || [])]
      .filter(distributor => distributor.active === true)
      .sort((a, b) => Number(a.priority || 999) - Number(b.priority || 999));

    for (const distributor of sortedDistributors) {
      const relatedCriteria = (distributorConfig.criteria || [])
        .filter(c => c.distributionId === distributor.id);

      const results = {};

      for (const criterion of relatedCriteria) {
        results[criterion.sequence] = evaluateCriterion(record, criterion);
      }

      const logicMatched = evaluateLogic(distributor.logic, results);

      if (logicMatched) {
        const agent = getNextAgent(distributor.id);

        assignments.push({
          recordId: record.Id,
          ownerId: agent ? agent.userId : record.OwnerId,
          matchedDistributorId: distributor.id,
          reason: agent
            ? `Matched ${distributor.name}`
            : `Matched ${distributor.name}, but no active agent found`
        });

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

  res.json({ assignments });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Distributor demo running on port ${port}`);
});
