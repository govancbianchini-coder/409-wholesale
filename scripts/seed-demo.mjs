// Seeds demo call-outs from data/demo/units.json (appraisals 409 has run, re-cut as dealer-safe market reports).
// Idempotent by VIN: a unit that already exists is left alone, so demo bids/awards survive deploys.
// Units land as "submitted" call-outs from 409 Motor Company so Approve & send can be shown live.
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
if (!url) { console.log("[seed-demo] No DATABASE_URL — skipping."); process.exit(0); }
const file = path.join(process.cwd(), "data", "demo", "units.json");
if (!fs.existsSync(file)) { console.log("[seed-demo] no data file"); process.exit(0); }
const units = JSON.parse(fs.readFileSync(file, "utf8"));

// lib/report.js is ESM without a .mjs extension; load it through a temp copy.
const tmp = path.join(process.cwd(), "scripts", ".report.tmp.mjs");
fs.copyFileSync(path.join(process.cwd(), "lib", "report.js"), tmp);
const { normalizeReport } = await import("file://" + tmp);
fs.unlinkSync(tmp);

const SELLER_EMAIL = env.DEMO_SELLER_EMAIL || "govan@overbid.ca";
const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
await client.connect();
try {
  const seller = (await client.query(`SELECT c.id, c.dealership, c.dealership_id FROM contacts c WHERE lower(c.email) = lower($1) AND NOT c.archived ORDER BY c.id LIMIT 1`, [SELLER_EMAIL])).rows[0];
  if (!seller) { console.log(`[seed-demo] seller ${SELLER_EMAIL} not found — skipping.`); process.exit(0); }
  // Optional photo mirroring to Vercel Blob so demo photos don't depend on third-party hotlinks.
  let put = null;
  if (process.env.BLOB_READ_WRITE_TOKEN) { try { ({ put } = await import("@vercel/blob")); } catch {} }
  async function mirror(url, key) {
    if (!put || !/^https?:/.test(url)) return url;
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Overbid demo seed)" }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) return url;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 5000) return url;
      const type = r.headers.get("content-type") || "image/jpeg";
      const b = await put(`demo/${key}.${/webp/.test(type) ? "webp" : "jpg"}`, buf, { access: "public", contentType: type, addRandomSuffix: false });
      return b.url;
    } catch { return url; }
  }
  let made = 0;
  for (const u of units) {
    const demoKey = `demo-stock:${u.stock || u.vin}`;
    const exists = (await client.query(`SELECT id FROM vehicles WHERE ($1::text IS NOT NULL AND vin = $1) OR internal_notes = $2`, [u.vin || null, demoKey])).rows[0];
    if (exists) continue;
    const report = u.report ? normalizeReport(u.report) : null;
    const r = await client.query(
      `INSERT INTO vehicles (vin, year, make, model, trim, km, exterior, interior, drivetrain, engine, transmission, announcements, dealer_notes, location, status, submitted_by, seller_dealership_id, seller_name, seller_source, closes_at, submitted_at, report, report_at, internal_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$15,$16,$10,$10,'Calgary, AB','submitted',$11,$12,$13,'Dealer call-out', now() + interval '2 hours', now(), $14, CASE WHEN $14::jsonb IS NULL THEN NULL ELSE now() END, $17) RETURNING id`,
      [u.vin || null, u.year, u.make, u.model, u.trim || null, u.km, u.exterior, u.interior, u.drivetrain || null, u.announcements, seller.id, seller.dealership_id, seller.dealership, report ? JSON.stringify(report) : null, u.engine || null, u.transmission || null, demoKey]
    );
    const id = r.rows[0].id;
    await client.query(`UPDATE vehicles SET code = 'W-' || (1000 + id) WHERE id = $1`, [id]);
    let i = 0;
    for (const url of u.photos) {
      const stored = await mirror(url, `${u.stock || u.vin}-${String(i + 1).padStart(2, "0")}`);
      await client.query(`INSERT INTO photos (vehicle_id, url, sort) VALUES ($1, $2, $3)`, [id, stored, i++]);
    }
    made++;
  }
  console.log(`[seed-demo] ${made} demo unit(s) created, ${units.length - made} already present.`);
} finally { await client.end(); }
