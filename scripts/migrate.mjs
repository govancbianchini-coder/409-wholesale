import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.log("[migrate] No DATABASE_URL set — skipping migration.");
  process.exit(0);
}
const local = /localhost|127\.0\.0\.1/.test(url);
const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
const sql = fs.readFileSync(path.join(process.cwd(), "lib", "schema.sql"), "utf8");
await client.connect();
await client.query(sql);
await client.end();
console.log("[migrate] Schema is up to date.");
