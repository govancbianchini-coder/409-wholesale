import { q, one } from "@/lib/db";
import { currentUser, int } from "@/lib/util";
import { normalizeReport } from "@/lib/report";

export const runtime = "nodejs";

// Who may write a report: a signed-in admin (browser session) or a caller with the API key.
async function allowed(req) {
  const key = req.headers.get("x-api-key");
  if (key && process.env.OVERBID_API_KEY && key === process.env.OVERBID_API_KEY) return true;
  const u = await currentUser();
  return u?.role === "admin";
}

// GET: the current report (admin/API only — dealers get it rendered on the bid page).
export async function GET(req, { params }) {
  if (!(await allowed(req))) return Response.json({ error: "Not allowed" }, { status: 401 });
  const { id } = await params;
  const v = await one(`SELECT id, code, vin, year, make, model, trim, km, report, report_at, carfax_url FROM vehicles WHERE id = $1 OR code = $2`, [int(id) || 0, String(id)]);
  if (!v) return Response.json({ error: "No such unit" }, { status: 404 });
  return Response.json(v);
}

// POST/PUT: replace the report. Body is the report object (see lib/report.js).
export async function POST(req, { params }) {
  if (!(await allowed(req))) return Response.json({ error: "Not allowed" }, { status: 401 });
  const { id } = await params;
  const v = await one(`SELECT id FROM vehicles WHERE id = $1 OR code = $2`, [int(id) || 0, String(id)]);
  if (!v) return Response.json({ error: "No such unit" }, { status: 404 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Body must be JSON" }, { status: 400 }); }
  let report;
  try { report = normalizeReport(body); } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
  await q(
    `UPDATE vehicles SET report = $2, report_at = now(),
       carfax_url = coalesce($3, carfax_url), carfax_summary = coalesce($4, carfax_summary), updated_at = now()
     WHERE id = $1`,
    [v.id, JSON.stringify(report), report.carfax?.url || null, report.carfax?.summary || null]
  );
  return Response.json({ ok: true, id: v.id, comps: report.comps.length, stats: report.stats });
}

export const PUT = POST;

export async function DELETE(req, { params }) {
  if (!(await allowed(req))) return Response.json({ error: "Not allowed" }, { status: 401 });
  const { id } = await params;
  await q(`UPDATE vehicles SET report = NULL, report_at = NULL, updated_at = now() WHERE id = $1 OR code = $2`, [int(id) || 0, String(id)]);
  return Response.json({ ok: true });
}
