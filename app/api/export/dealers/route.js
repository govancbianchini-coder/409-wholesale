import { dealerStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

const cell = (v) => {
  const s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  const rows = await dealerStats({ where: "TRUE", order: "c.dealership, c.first_name" });
  const cols = ["first_name", "last_name", "dealership", "brand", "role", "email", "phone", "consent_email", "consent_sms", "email_opt_out", "sms_opt_out", "consent_at", "consent_by", "pref_makes", "pref_min_price", "pref_max_price", "pref_max_km", "notes", "invites", "views", "bids", "wins", "won_value", "archived", "created_at"];
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="409-wholesale-dealers.csv"` },
  });
}
