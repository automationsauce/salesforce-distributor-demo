const express = require("express");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Salesforce Distributor Demo is running");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});
//Sync Distribution Data
app.post("/sync", (req, res) => {
  console.log("SYNC HIT");
  console.log(JSON.stringify(req.body, null, 2));

  res.json({
    success: true,
    message: "Metadata synced"
  });
});
//Assign Records Logic
app.post("/assign-bulk", (req, res) => {
  const records = req.body.records || [];

  const assignments = records.map((record) => {
    let ownerId = "005DEFAULTUSERID";
    let reason = "Default assignment";

    if (record.LeadSource === "SEO/Direct" && Number(record.Number_Of_Units__c) > 3) {
      ownerId = "005USERAIDHERE";
      reason = "Matched Direct 3+ distributor";
    } else if (record.LeadSource === "SEO/Natural" && Number(record.Number_Of_Units__c) > 3) {
      ownerId = "005USERBIDHERE";
      reason = "Matched Natural 3+ distributor";
    }

    return {
      recordId: record.Id,
      ownerId,
      reason
    };
  });

  res.json({ assignments });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Distributor demo running on port ${port}`);
});
