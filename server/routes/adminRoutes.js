const express = require("express");
const router = express.Router();

const {
  requireAdminKey
} = require("../middleware/adminAuthMiddleware");

const {
  getAdminAccounts
} = require("../services/adminService");

const {
  loadAccount
} = require("../services/accountLoaderService");

router.use(requireAdminKey);

router.get("/accounts", async (req, res) => {
  try {
    const accounts = await getAdminAccounts();
    res.json({ accounts });
  } catch (e) {
    console.error("ADMIN ACCOUNTS ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

router.get("/accounts/:accountKey", async (req, res) => {
  try {
    const account = await loadAccount(req.params.accountKey);

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.json(account);
  } catch (e) {
    console.error("ADMIN ACCOUNT DETAIL ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;