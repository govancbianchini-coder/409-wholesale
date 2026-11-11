import pg from "pg";
import { databaseUrl } from "./env";

const url = databaseUrl();
// DATE columns come back as plain YYYY-MM-DD strings (no timezone shift).
pg.types.setTypeParser(1082, (v) => v);

let pool = globalThis.__wsPool;
if (!pool) {
  const local = url && /localhost|127\.0\.0\.1/.test(url);
  pool = new pg.Pool({
    connectionString: url,
    ssl: local ? false : { rejectUnauthorized: false },
    max: 5,
  });
  globalThis.__wsPool = pool;
}

export async function q(text, params = []) {
  const res = await pool.query(text, params);
  return res.rows;
}

export async function one(text, params = []) {
  const rows = await q(text, params);
  return rows[0] || null;
}
