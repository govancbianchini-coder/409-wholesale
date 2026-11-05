import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const env = process.env;
let url = env.DATABASE_URL || env.POSTGRES_URL;
if (!url) {
  const pg = Object.entries(env).filter(([, v]) => typeof v === "string" && /^postgres(ql)?:\/\//.test(v));
  const score = ([k]) => (/UNPOOLED|NON_POOLING|NO_SSL|PRISMA/.test(k) ? 1 : 0) + (/_URL$/.test(k) ? 0 : 2);
  pg.sort((a, b) => score(a) - score(b));
  url = pg[0]?.[1];
}
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
