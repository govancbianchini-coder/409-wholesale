// Seeds gtm_targets from data/gtm_targets.csv. Idempotent: existing rows (by dealership name) are left alone,
// so Kevin's statuses and notes survive every deploy. Runs after migrate in the Vercel build.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const env = process.env;
let url = env.DATABASE_URL || env.POSTGRES_URL;
if (!url) {
  const found = Object.entries(env).filter(([, v]) => typeof v === "string" && /^postgres(ql)?:\/\//.test(v));
  const score = ([k]) => (/UNPOOLED|NON_POOLING|NO_SSL|PRISMA/.test(k) ? 1 : 0) + (/_URL$/.test(k) ? 0 : 2);
  found.sort((a, b) => score(a) - score(b));
  url = found[0]?.[1];
}
if (!url) { console.log("[seed-gtm] No DATABASE_URL — skipping."); process.exit(0); }

function parseCsv(text) {
  const rows = []; let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [hdr, ...rest] = rows;
  return rest.filter((r) => r.length > 1).map((r) => Object.fromEntries(hdr.map((h, i) => [h, r[i] ?? ""])));
}

const CLUSTERS = [
  "NW – Royal Oak / Stoney Trail Auto Mall", "NW – Crowfoot", "NW – Shaganappi / Northland / Crowchild",
  "NE – Country Hills / Stonehill", "NE – Barlow / Sunridge / Meridian", "Central / SW – Downtown & Bow Trail",
  "SW – 101 St / Glenmore / Richmond", "S – Macleod Trail (north half)", "SE – Calgary Auto Mall (Glendeer / Heritage Meadows)",
  "S – Macleod Trail (south half) / Lake Fraser", "SE – South Trail / 130 Ave / Douglasdale", "Airdrie (409 home turf)",
];

const local = /localhost|127\.0\.0\.1/.test(url);
const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
await client.connect();
const rows = parseCsv(fs.readFileSync(path.join(process.cwd(), "data", "gtm_targets.csv"), "utf8"));
let n = 0;
for (const r of rows) {
  const cno = CLUSTERS.indexOf(r["Cluster"]) + 1;
  const res = await client.query(
    `INSERT INTO gtm_targets (route_order, cluster_no, cluster, dealership, brands, grp, address, phone, gm, gsm, contact_notes, priority)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (dealership) DO NOTHING`,
    [Number(r["Route #"]), cno, r["Cluster"], r["Dealership"], r["Brands"], r["Group"], r["Address"], r["Main phone"] || null,
     r["GM"] || null, r["GSM"] || null, r["Other contact / email"] || null, r["Priority"] || "B"]
  );
  n += res.rowCount;
}
// Link targets to dealerships that already exist (by name, case-insensitive) so sign-ups show automatically.
await client.query(`UPDATE gtm_targets t SET dealership_id = d.id FROM dealerships d
  WHERE t.dealership_id IS NULL AND lower(d.name) = lower(t.dealership)`);
await client.end();
console.log(`[seed-gtm] ${n} new targets (${rows.length} in file).`);
