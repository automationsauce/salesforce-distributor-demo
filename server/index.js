require("dotenv").config();
const express = require("express");
const app = express();
const {
  evaluateCriterion,
  evaluateLogic
} = require("./services/logicService");

const {
  upsertAccount
} = require("./services/accountService");

const {
  upsertConnection
} = require("./services/crmConnectionService");

const {
  upsertObjectConfig
} = require("./services/objectConfigService");

const {
  refreshSalesforceToken,
  querySalesforce,
  updateOwner,
  updateDistributorNextAgent
} = require("./crm/salesforce/salesforceService");

const {
  getNextAgentForDistributor
} = require("./services/assignmentService");

const {
  pollAccount
} = require("./services/pollingService");


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

// Sync Distribution Data
app.post("/sync", async (req, res) => {
  try {
    const accountId = req.body.settings?.accountId;

    if (!accountId) {
      return res.status(400).json({ error: "Missing accountId" });
    }

    const account = await upsertAccount(
      accountId,
      req.body.settings?.accountName || accountId
    );

    await upsertConnection(
      account.id, // IMPORTANT: database UUID, not TEST123456
      "salesforce",
      req.body.salesforceConnection?.instanceUrl,
      req.body.salesforceConnection?.clientId,
      req.body.salesforceConnection?.clientSecret,
      req.body.salesforceConnection?.refreshToken
    );

    for (const cfg of req.body.objectConfigs || []) {
      await upsertObjectConfig(
        account.id,
        cfg.objectApiName,
        cfg.entryQueueId,
        cfg.requiredFields || ["Id", "OwnerId"],
        req.body.settings?.enablePolling ?? true,
        true
      );
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

  } catch (e) {
    console.error("SYNC ERROR:", e);
    res.status(500).json({
      error: e.message
    });
  }
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



const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Distributor demo running on port ${port}`);
});

setInterval(async () => {
  for (const accountId in accounts) {
    const account = accounts[accountId];

    if (!account.settings?.enablePolling) continue;

    try {
      console.log("Auto polling:", accountId);
      await pollAccount(account);
    } catch (e) {
      console.error("Polling error:", e.message);
    }
  }
}, 30000); // every 30 seconds
