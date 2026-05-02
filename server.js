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

app.use((req, res, next) => {
  console.log("REQUEST HIT:", req.method, req.url);
  next();
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
  distributorConfig = {
    settings: req.body.settings || {},
    distributors: req.body.distributors || (req.body.distributor ? [req.body.distributor] : []),
    criteria: req.body.criteria || [],
    agents: req.body.agents || []
  };

  console.log("SYNC HIT");
  console.log(JSON.stringify(distributorConfig, null, 2));

  res.json({
    success: true,
    message: "Metadata synced",
    distributorCount: distributorConfig.distributors.length,
    criteriaCount: distributorConfig.criteria.length,
    agentCount: distributorConfig.agents.length
  });
});
// Config
app.get("/config", (req, res) => {
  res.json(distributorConfig);
});
// Pass For Distribution
app.get("/test-logic", (req, res) => {
  res.send("test-logic exists, but use POST with JSON body");
});
// Check Logic
app.post("/test-logic", (req, res) => {
  const record = req.body.record;
  const testResults = [];

  for (const distributor of distributorConfig.distributors || []) {
    const relatedCriteria = (distributorConfig.criteria || [])
      .filter(c => c.distributionId === distributor.id);

    const criteriaResults = {};

    for (const criterion of relatedCriteria) {
      criteriaResults[criterion.sequence] = evaluateCriterion(record, criterion);
    }

    let matched = false;
    let error = null;

    try {
      matched = evaluateLogic(distributor.logic, criteriaResults);
    } catch (e) {
      error = e.message;
    }

    testResults.push({
      distributorId: distributor.id,
      distributorName: distributor.name,
      logic: distributor.logic,
      criteriaResults,
      matched,
      error
    });
  }

  res.json({ results: testResults });
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
