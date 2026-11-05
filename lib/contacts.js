"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { q, one } from "./db";
import { token, currentUser, int, str, phoneE164 } from "./util";

function fields(fd) {
  const email = str(fd.get("email"))?.toLowerCase() || null;
  const phoneRaw = str(fd.get("phone"));
  const phone = phoneE164(phoneRaw);
  return {
    first_name: str(fd.get("first_name")),
    last_name: str(fd.get("last_name")),
    dealership: str(fd.get("dealership")),
    brand: str(fd.get("brand")),
    role: str(fd.get("role")),
    email,
    phone,
    phoneRaw,
    consent_email: fd.get("consent_email") === "on",
    consent_sms: fd.get("consent_sms") === "on",
    pref_makes: str(fd.get("pref_makes")),
    pref_min_price: int(fd.get("pref_min_price")),
    pref_max_price: int(fd.get("pref_max_price")),
    pref_max_km: int(fd.get("pref_max_km")),
    notes: str(fd.get("notes")),
  };
}

function validate(f) {
  if (!f.first_name) return "First name is required.";
  if (!f.dealership) return "Dealership is required.";
  if (!f.email && !f.phoneRaw) return "Add an email or a cell number.";
  if (f.phoneRaw && !f.phone) return "That cell number doesn't look right — use 10 digits.";
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return "That email doesn't look right.";
  if (f.email && !f.consent_email && f.phone && !f.consent_sms) return "They need to agree to at least one: email or text.";
  return null;
}

export async function createContact(_prev, fd) {
  const user = await currentUser();
  const f = fields(fd);
  const err = validate(f);
  if (err) return { error: err, values: Object.fromEntries(fd) };
  if (f.email) {
    const dup = await one(`SELECT id, first_name, dealership FROM contacts WHERE lower(email) = $1`, [f.email]);
    if (dup) return { error: `${dup.first_name} at ${dup.dealership} already has that email.`, values: Object.fromEntries(fd) };
  }
  const anyConsent = f.consent_email || f.consent_sms;
  const row = await one(
    `INSERT INTO contacts (token, first_name, last_name, dealership, brand, role, email, phone, consent_email, consent_sms,
      consent_at, consent_by, consent_method, pref_makes, pref_min_price, pref_max_price, pref_max_km, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
    [token(12), f.first_name, f.last_name, f.dealership, f.brand, f.role, f.email, f.phone, f.consent_email, f.consent_sms,
     anyConsent ? new Date() : null, anyConsent ? user?.name : null, anyConsent ? str(fd.get("consent_method")) || "In person" : null,
     f.pref_makes, f.pref_min_price, f.pref_max_price, f.pref_max_km, f.notes, user?.name]
  );
  revalidatePath("/dealers");
  return { ok: true, id: row.id, name: `${f.first_name} ${f.last_name || ""}`.trim(), dealership: f.dealership };
}

export async function updateContact(_prev, fd) {
  const id = int(fd.get("id"));
  const f = fields(fd);
  const err = validate(f);
  if (err) return { error: err };
  const before = await one(`SELECT consent_email, consent_sms FROM contacts WHERE id = $1`, [id]);
  const user = await currentUser();
  const newlyConsented = (f.consent_email && !before.consent_email) || (f.consent_sms && !before.consent_sms);
  await q(
    `UPDATE contacts SET first_name=$2, last_name=$3, dealership=$4, brand=$5, role=$6, email=$7, phone=$8,
       consent_email=$9, consent_sms=$10, pref_makes=$11, pref_min_price=$12, pref_max_price=$13, pref_max_km=$14, notes=$15,
       consent_at = CASE WHEN $16 THEN now() ELSE consent_at END,
       consent_by = CASE WHEN $16 THEN $17 ELSE consent_by END,
       consent_method = CASE WHEN $16 THEN 'Updated by admin' ELSE consent_method END,
       email_opt_out = CASE WHEN $9 AND NOT consent_email THEN FALSE ELSE email_opt_out END,
       sms_opt_out = CASE WHEN $10 AND NOT consent_sms THEN FALSE ELSE sms_opt_out END,
       updated_at = now()
     WHERE id = $1`,
    [id, f.first_name, f.last_name, f.dealership, f.brand, f.role, f.email, f.phone, f.consent_email, f.consent_sms,
     f.pref_makes, f.pref_min_price, f.pref_max_price, f.pref_max_km, f.notes, newlyConsented, user?.name]
  );
  revalidatePath(`/dealers/${id}`);
  return { ok: true };
}

export async function archiveContact(fd) {
  const id = int(fd.get("id"));
  const archived = fd.get("archived") === "1";
  await q(`UPDATE contacts SET archived = $2, updated_at = now() WHERE id = $1`, [id, archived]);
  revalidatePath("/dealers");
  redirect(archived ? "/dealers" : `/dealers/${id}`);
}

// CSV import: header row required. Recognised columns (case-insensitive):
// first_name, last_name, dealership, brand, role, email, phone, consent_email, consent_sms, pref_makes, notes
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

const yes = (v) => /^(y|yes|true|1|x)$/i.test(String(v || "").trim());

export async function importContacts(_prev, fd) {
  const user = await currentUser();
  const file = fd.get("file");
  const text = file && typeof file.text === "function" ? await file.text() : String(fd.get("csv") || "");
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: "No rows found. The first row must be column headers." };
  const head = rows[0].map((h) => h.trim().toLowerCase().replace(/[^a-z_]/g, "_"));
  const idx = (n) => head.indexOf(n);
  const get = (r, n) => (idx(n) >= 0 ? (r[idx(n)] || "").trim() : "");
  let added = 0, skipped = [];
  for (const r of rows.slice(1)) {
    const email = get(r, "email").toLowerCase() || null;
    const phone = phoneE164(get(r, "phone") || get(r, "cell"));
    const first = get(r, "first_name") || get(r, "name").split(" ")[0];
    const dealership = get(r, "dealership") || get(r, "store");
    if (!first || !dealership || (!email && !phone)) { skipped.push(`${first || "?"} (${dealership || "no store"}) — missing name, store or contact`); continue; }
    if (email && (await one(`SELECT 1 FROM contacts WHERE lower(email)=$1`, [email]))) { skipped.push(`${email} — already in the list`); continue; }
    const ce = yes(get(r, "consent_email")), cs = yes(get(r, "consent_sms"));
    await q(
      `INSERT INTO contacts (token, first_name, last_name, dealership, brand, role, email, phone, consent_email, consent_sms, consent_at, consent_by, consent_method, pref_makes, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [token(12), first, get(r, "last_name") || get(r, "name").split(" ").slice(1).join(" ") || null, dealership, get(r, "brand") || null, get(r, "role") || null,
       email, phone, ce, cs, ce || cs ? new Date() : null, ce || cs ? user?.name : null, ce || cs ? "CSV import (consent recorded offline)" : null,
       get(r, "pref_makes") || null, get(r, "notes") || null, user?.name]
    );
    added++;
  }
  revalidatePath("/dealers");
  return { ok: true, added, skipped };
}
