require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("./connection");

async function initDb() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");

  await pool.query(schema);
  console.log("Database initialized");

  await pool.end();
}

initDb().catch((err) => {
  console.error(err);
  process.exit(1);
});