"use server";
import { revalidatePath } from "next/cache";
import { q, one } from "./db";
import { currentUser } from "./util";
import { RANK, setSetting } from "./gtm";

// ---------- Actions ----------
export async function logTouch(kind, outcome, fd) {
  const user = await currentUser();
  const id = Number(fd.get("id"));
  kind = String(kind || "note"); outcome = String(outcome || "");
  const met = String(fd.get("met_with") || "").trim() || null;
  const note = String(fd.get("note") || "").trim() || null;
  const nextStep = String(fd.get("next_step") || "").trim();
  const nextAt = String(fd.get("next_at") || "").trim();
  await q(`INSERT INTO gtm_visits (target_id, by_name, kind, outcome, met_with, note) VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, user?.name || null, kind, outcome || null, met, note]);
  const t = await one(`SELECT status, owner FROM gtm_targets WHERE id = $1`, [id]);
  const sets = ["updated_at = now()"]; const params = [id];
  // Status only moves forward (or to not_interested); auto statuses are computed at read time.
  if (outcome && (outcome === "not_interested" || (RANK[outcome] ?? 0) > (RANK[t.status] ?? 0))) { params.push(outcome); sets.push(`status = $${params.length}`); }
  if (!t.owner && user?.name) { params.push(user.name); sets.push(`owner = $${params.length}`); }
  if (fd.has("next_step")) { params.push(nextStep || null); sets.push(`next_step = $${params.length}`); params.push(nextAt || null); sets.push(`next_at = $${params.length}`); }
  await q(`UPDATE gtm_targets SET ${sets.join(", ")} WHERE id = $1`, params);
  revalidatePath("/gtm"); revalidatePath(`/gtm/store/${id}`); revalidatePath("/gtm/board");
}

export async function updateTarget(fd) {
  const id = Number(fd.get("id"));
  const fields = ["gm", "gsm", "phone", "contact_notes", "owner", "next_step", "priority"];
  const sets = ["updated_at = now()"]; const params = [id];
  for (const f of fields) if (fd.has(f)) { params.push(String(fd.get(f) || "").trim() || null); sets.push(`${f} = $${params.length}`); }
  if (fd.has("next_at")) { params.push(String(fd.get("next_at") || "") || null); sets.push(`next_at = $${params.length}`); }
  if (fd.has("status")) { params.push(String(fd.get("status"))); sets.push(`status = $${params.length}`); }
  if (fd.has("dealership_id")) { const v = Number(fd.get("dealership_id")); params.push(v || null); sets.push(`dealership_id = $${params.length}`); }
  await q(`UPDATE gtm_targets SET ${sets.join(", ")} WHERE id = $1`, params);
  revalidatePath("/gtm"); revalidatePath(`/gtm/store/${id}`); revalidatePath("/gtm/board");
}

export async function setStartDate(fd) {
  const v = String(fd.get("start_date") || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) await setSetting("start_date", v);
  revalidatePath("/gtm"); revalidatePath("/gtm/board");
}
