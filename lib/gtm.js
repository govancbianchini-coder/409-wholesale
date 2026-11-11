import { q, one } from "./db";
import { TZ } from "./util";

// ---------- Status model ----------
// Manual statuses are set by the rep. Auto statuses come from the platform (a linked dealership, its bids, its listings).
// The effective status is whichever is further along, so nobody has to remember to tick "signed".
export const STATUSES = [
  ["not_contacted", "Not contacted", 0],
  ["called", "Called", 1],
  ["meeting", "Meeting booked", 2],
  ["demo", "Demo done", 3],
  ["signed", "Signed up", 4],
  ["bidding", "Bidding", 5],
  ["listed", "Listed a unit", 6],
  ["selling", "Sold a unit", 7],
  ["not_interested", "Not interested", -1],
];
export const LABEL = Object.fromEntries(STATUSES.map(([k, l]) => [k, l]));
export const RANK = Object.fromEntries(STATUSES.map(([k, , r]) => [k, r]));

// Quick-log buttons on the store page: [kind, outcome status, label]
export const TOUCHES = [
  ["call", "called", "Called – no answer / left msg"],
  ["call", "meeting", "Called – meeting booked"],
  ["visit", "called", "Visited – GSM not in"],
  ["visit", "demo", "Visited – did the demo"],
  ["visit", "signed", "Visited – signed up"],
  ["meeting", "demo", "Group meeting done"],
  ["note", "not_interested", "Not interested"],
];

// ---------- The 90-day plan ----------
export const PLAN = [
  { week: 1, clusters: [12, 9], label: "Airdrie, then Calgary Auto Mall", goal: "409 lists 10 seed units. Sign the 4 Airdrie stores + 5 Auto Mall stores. First outside unit sold by Friday." },
  { week: 2, clusters: [11], label: "South Trail / Douglasdale", goal: "Govan meets McManes. Sign Woodridge, Jack Carter, South Pointe Toyota." },
  { week: 3, clusters: [10], label: "Macleod south / Lake Fraser + Friday second visits", goal: "Capital, Kramer, Advantage, Tower signed. 15 signed, 8 bidding, 25 units." },
  { week: 4, clusters: [5], label: "Barlow / Sunridge / Meridian", goal: "CMP, Eastside Dodge, Stampede Toyota, Universal Ford. Govan: Kaizen + Wood meetings." },
  { week: 5, clusters: [4, 6], label: "Country Hills / Stonehill + Downtown", goal: "McManes decision; Renfrew signed." },
  { week: 6, clusters: [], label: "Follow-up week", goal: "Every signed store that hasn't bid gets a visit with a live unit. 35 signed, 20 bidding, 70 units. First results email." },
  { week: 7, clusters: [1], label: "Royal Oak / Stoney Trail", goal: "Lexus Royal Oak, Charlesglen, Village Honda, Audi Royal Oak. Govan: Dilawri." },
  { week: 8, clusters: [2, 3], label: "Crowfoot + Shaganappi / Northland", goal: "Northland VW, Shaganappi GM, Crowfoot Chrysler." },
  { week: 9, clusters: [7, 8], label: "SW 101 St / Glenmore + Macleod north", goal: "Wolfe, Wheaton Honda West, Big 4, Shaw GMC. Shostak via Porsche Centre." },
  { week: 10, clusters: [], label: "Second pass", goal: "Every Called / Not interested store gets a second visit with a results sheet. 50 signed, 32 bidding." },
  { week: 11, clusters: [], label: "Dealer breakfast", goal: "20–30 GSMs in a room. Sign 8 holdouts." },
  { week: 12, clusters: [], label: "Activation week", goal: "Every signed store sells or bids on at least one unit. 60 signed, 40 bidding, 25 selling, 150 units." },
];
export const TARGETS = { 30: { visited: 40, signed: 15, bidding: 8, selling: 4 }, 60: { visited: 84, signed: 35, bidding: 20, selling: 12 }, 90: { visited: 84, signed: 60, bidding: 40, selling: 25 } };

// Rank of the manual status vs. what the platform shows; the higher one wins.
const EFFECTIVE = `
  CASE WHEN t.status = 'not_interested' AND t.dealership_id IS NULL AND bids.n = 0 THEN 'not_interested'
       ELSE (SELECT k FROM (VALUES
              ('selling', CASE WHEN sold.n > 0 OR t.status = 'selling' THEN 7 ELSE -9 END),
              ('listed',  CASE WHEN listed.n > 0 OR t.status = 'listed' THEN 6 ELSE -9 END),
              ('bidding', CASE WHEN bids.n > 0 OR t.status = 'bidding' THEN 5 ELSE -9 END),
              ('signed',  CASE WHEN t.dealership_id IS NOT NULL OR t.status = 'signed' THEN 4 ELSE -9 END),
              ('demo',    CASE WHEN t.status = 'demo' THEN 3 ELSE -9 END),
              ('meeting', CASE WHEN t.status = 'meeting' THEN 2 ELSE -9 END),
              ('called',  CASE WHEN t.status = 'called' THEN 1 ELSE -9 END),
              ('not_contacted', 0)) AS s(k, r) ORDER BY r DESC LIMIT 1)
  END`;

const BASE = `
  FROM gtm_targets t
  LEFT JOIN LATERAL (SELECT count(*) n FROM bids b JOIN contacts c ON c.id = b.contact_id
                     WHERE NOT b.superseded AND (c.dealership_id = t.dealership_id OR lower(c.dealership) = lower(t.dealership))) bids ON true
  LEFT JOIN LATERAL (SELECT count(*) n FROM vehicles v WHERE v.seller_dealership_id = t.dealership_id AND t.dealership_id IS NOT NULL) listed ON true
  LEFT JOIN LATERAL (SELECT count(*) n FROM vehicles v WHERE v.seller_dealership_id = t.dealership_id AND t.dealership_id IS NOT NULL AND v.status = 'awarded') sold ON true
  LEFT JOIN LATERAL (SELECT max(created_at) at, count(*) n, count(*) FILTER (WHERE kind IN ('visit','meeting','demo')) visits FROM gtm_visits gv WHERE gv.target_id = t.id) touch ON true`;

const SELECT = `SELECT t.*, ${EFFECTIVE} AS eff, bids.n::int AS bid_count, listed.n::int AS listed_count, sold.n::int AS sold_count,
  touch.at AS last_touch, touch.n::int AS touches, touch.visits::int AS visits ${BASE}`;

export async function listTargets({ cluster = null, status = null, owner = null } = {}) {
  const where = [];
  const params = [];
  if (cluster) { params.push(cluster); where.push(`t.cluster_no = $${params.length}`); }
  if (owner) { params.push(owner); where.push(`t.owner = $${params.length}`); }
  let rows = await q(`${SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY t.route_order`, params);
  if (status) rows = rows.filter((r) => r.eff === status);
  return rows;
}

export async function getTarget(id) {
  const t = await one(`${SELECT} WHERE t.id = $1`, [id]);
  if (!t) return null;
  t.log = await q(`SELECT * FROM gtm_visits WHERE target_id = $1 ORDER BY created_at DESC LIMIT 50`, [id]);
  return t;
}

export async function summary() {
  const rows = await q(`${SELECT}`);
  const by = (k) => rows.filter((r) => r.eff === k).length;
  const rank = (r) => RANK[r.eff] ?? 0;
  const s = {
    total: rows.length,
    visited: rows.filter((r) => r.visits > 0).length,
    contacted: rows.filter((r) => rank(r) >= 1 || r.eff === "not_interested").length,
    signed: rows.filter((r) => rank(r) >= 4).length,
    bidding: rows.filter((r) => rank(r) >= 5).length,
    selling: rows.filter((r) => rank(r) >= 7).length,
    not_interested: by("not_interested"),
    byStatus: Object.fromEntries(STATUSES.map(([k]) => [k, by(k)])),
    clusters: [],
  };
  for (let c = 1; c <= 12; c++) {
    const cr = rows.filter((r) => r.cluster_no === c);
    if (!cr.length) continue;
    s.clusters.push({ no: c, name: cr[0].cluster, total: cr.length, visited: cr.filter((r) => r.visits > 0).length,
      signed: cr.filter((r) => rank(r) >= 4).length, bidding: cr.filter((r) => rank(r) >= 5).length });
  }
  s.overdue = rows.filter((r) => r.next_at && new Date(r.next_at) < startOfToday()).sort((a, b) => new Date(a.next_at) - new Date(b.next_at));
  s.dueToday = rows.filter((r) => r.next_at && sameDay(new Date(r.next_at), new Date()));
  return s;
}

export async function activity(limit = 30) {
  return q(`SELECT gv.*, t.dealership, t.id AS target_id FROM gtm_visits gv JOIN gtm_targets t ON t.id = gv.target_id ORDER BY gv.created_at DESC LIMIT $1`, [limit]);
}

export async function weekStats() {
  // visits per rep, this week (Mon–Sun, Calgary time) and today
  return q(`SELECT coalesce(by_name,'—') rep,
      count(*) FILTER (WHERE created_at >= date_trunc('week', now() AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}')::int AS week_touches,
      count(*) FILTER (WHERE kind IN ('visit','meeting','demo') AND created_at >= date_trunc('week', now() AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}')::int AS week_visits,
      count(*) FILTER (WHERE (created_at AT TIME ZONE '${TZ}')::date = (now() AT TIME ZONE '${TZ}')::date)::int AS today_touches,
      count(*) FILTER (WHERE outcome = 'signed' AND created_at >= date_trunc('week', now() AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}')::int AS week_signed
    FROM gtm_visits GROUP BY 1 ORDER BY week_visits DESC`);
}

// ---------- Plan / week ----------
export async function getSetting(key) {
  const r = await one(`SELECT value FROM gtm_settings WHERE key = $1`, [key]);
  return r?.value ?? null;
}
export async function setSetting(key, value) {
  await q(`INSERT INTO gtm_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [key, value]);
}
export async function currentWeek() {
  const start = await getSetting("start_date");
  if (!start) return { week: 1, start: null, day: 0 };
  const d0 = new Date(start + "T00:00:00-07:00");
  const days = Math.floor((Date.now() - d0.getTime()) / 86400000);
  return { week: Math.min(12, Math.max(1, Math.floor(days / 7) + 1)), start, day: Math.max(0, days) };
}

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function sameDay(a, b) { return a.toDateString() === b.toDateString(); }

