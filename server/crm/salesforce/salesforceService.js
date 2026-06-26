
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

  const text = await res.text();

  console.log("Salesforce query status:", res.status);
  console.log("Salesforce query body:", text);

  if (!res.ok) {
    throw new Error(`Salesforce query failed ${res.status}: ${text}`);
  }

  if (!text) {
    throw new Error("Salesforce query returned empty body");
  }

  return JSON.parse(text);
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

async function updateOwner(account, objectApiName, recordId, ownerId) {
  const token = await refreshSalesforceToken(account);

  const url =
    token.instance_url +
    `/services/data/v60.0/sobjects/${objectApiName}/${recordId}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + token.access_token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      OwnerId: ownerId
    })
  });

  if (!response.ok) {
    throw new Error("Owner update failed: " + await response.text());
  }
}

module.exports = {
  refreshSalesforceToken,
  querySalesforce,
  updateOwner,
  updateDistributorNextAgent
};