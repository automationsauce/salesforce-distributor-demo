const express = require("express");
const app = express();
let accounts = {};

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

app.get("/oauth/callback", (req, res) => {
  res.send(`
    <h2>Salesforce OAuth Callback</h2>
    <p>Code:</p>
    <pre>${req.query.code || "No code received"}</pre>
    <p>Error:</p>
    <pre>${req.query.error || ""}</pre>
  `);
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

function getNextAgentForDistributor(account, distributor) {
  const activeAgents = (account.agents || [])
    .filter(agent =>
      agent.distributionId === distributor.id &&
      agent.active === true
    )
    .sort((a, b) => Number(a.sequence) - Number(b.sequence));

  if (activeAgents.length === 0) {
    return {
      agent: null,
      nextAgentSequence: distributor.nextAgent || null
    };
  }

  const nextSequence = Number(distributor.nextAgent || activeAgents[0].sequence);

  let selectedIndex = activeAgents.findIndex(
    agent => Number(agent.sequence) === nextSequence
  );

  if (selectedIndex === -1) {
    selectedIndex = 0;
  }

  const selectedAgent = activeAgents[selectedIndex];

  const nextIndex = selectedIndex + 1 >= activeAgents.length
    ? 0
    : selectedIndex + 1;

  const nextAgentSequence = Number(activeAgents[nextIndex].sequence);

  distributor.nextAgent = nextAgentSequence;

  return {
    agent: selectedAgent,
    nextAgentSequence
  };
}

async function updateDistributorNextAgent(account, distributorId, nextAgentSequence) {
  const token = await refreshSalesforceToken(account);

  const url =
    token.instance_url +
    `/services/data/v60.0/sobjects/Distribution__c/${distributorId}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + token.access_token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      Next_Agent__c: nextAgentSequence
    })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

// Sync Distribution Data
app.post("/sync", (req, res) => {
  const accountId = req.body.settings?.accountId;

  if (!accountId) {
    return res.status(400).json({ error: "Missing accountId" });
  }

  accounts[accountId] = {
    settings: req.body.settings || {},
    salesforceConnection: req.body.salesforceConnection || {},
    distributors: req.body.distributors || [],
    criteria: req.body.criteria || [],
    agents: req.body.agents || [],
    objectConfigs: req.body.objectConfigs || []
  };

  distributorConfig = accounts[accountId];

  res.json({
    success: true,
    message: "Metadata and Salesforce connection synced",
    accountId
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
app.post("/assign-bulk", async (req, res) => {
  const account = distributorConfig;

  const records = req.body.records || [];
  const assignments = [];

  for (const record of records) {
    let matched = false;

    const sortedDistributors = [...(account.distributors || [])]
      .filter(distributor => distributor.active === true)
      .sort((a, b) => Number(a.priority || 999) - Number(b.priority || 999));

    for (const distributor of sortedDistributors) {
      const relatedCriteria = (account.criteria || [])
        .filter(c => c.distributionId === distributor.id);

      const results = {};

      for (const criterion of relatedCriteria) {
        results[criterion.sequence] = evaluateCriterion(record, criterion);
      }

      const logicMatched = evaluateLogic(distributor.logic, results);

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

  res.json({ assignments });
});

async function querySalesforce(account, soql) {
  const token = await refreshSalesforceToken(account);

  const url =
    token.instance_url +
    "/services/data/v60.0/query?q=" +
    encodeURIComponent(soql);

  const res = await fetch(url, {
    headers: {
      Authorization: "Bearer " + token.access_token
    }
  });

  return await res.json();
}

async function refreshSalesforceToken(account) {
  const conn = account.salesforceConnection || {};

  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("client_id", conn.clientId);
  params.append("client_secret", conn.clientSecret);
  params.append("refresh_token", conn.refreshToken);

  const response = await fetch("https://login.salesforce.com/services/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error("Token refresh failed: " + JSON.stringify(body));
  }

  return body;
}

app.post("/poll/:accountId", async (req, res) => {
  const account = accounts[req.params.accountId];

  if (!account) {
    return res.status(404).json({ error: "Account not found" });
  }

  try {
    const result = await pollAccount(account);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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

    const assignments = records.records.map(record => ({
      recordId: record.Id,
      ownerId: record.OwnerId
    }));

    results.push({
      object: config.objectApiName,
      recordsFound: records.records.length,
      assignments
    });
  }

  return results;
}

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Distributor demo running on port ${port}`);
});
