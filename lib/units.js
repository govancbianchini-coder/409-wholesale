"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { q, one } from "./db";
import { token, currentUser, int, str, TZ, appUrl } from "./util";
import { sendEmail, sendSms, inviteEmail, inviteSms, wonEmail, wonSms } from "./messaging";

// "2026-11-02T15:00" interpreted in America/Edmonton → Date
function localToDate(s) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(guess)).map((p) => [p.type, p.value])
  );
  const asTz = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess - (asTz - guess));
}

async function requireAdmin() {
  const u = await currentUser();
  if (u?.role !== "admin") throw new Error("Admins only");
  return u;
}

function vehicleFields(fd) {
  return [
    str(fd.get("vin"))?.toUpperCase() || null, int(fd.get("year")), str(fd.get("make")), str(fd.get("model")), str(fd.get("trim")),
    int(fd.get("km")), str(fd.get("exterior")), str(fd.get("interior")), str(fd.get("drivetrain")), str(fd.get("engine")),
    str(fd.get("transmission")), str(fd.get("condition_notes")), str(fd.get("announcements")), str(fd.get("carfax_url")),
    str(fd.get("carfax_summary")), str(fd.get("location")), str(fd.get("seller_name")), str(fd.get("seller_source")),
    int(fd.get("seller_ask")), int(fd.get("margin_target")) ?? 1500, localToDate(str(fd.get("closes_at"))), str(fd.get("internal_notes")),
  ];
}

export async function saveVehicle(_prev, fd) {
  await requireAdmin();
  const id = int(fd.get("id"));
  const vals = vehicleFields(fd);
  if (!vals[1] || !vals[2] || !vals[3]) return { error: "Year, make and model are required." };
  if (!vals[20]) return { error: "Set when bidding closes." };
  if (id) {
    await q(
      `UPDATE vehicles SET vin=$2, year=$3, make=$4, model=$5, trim=$6, km=$7, exterior=$8, interior=$9, drivetrain=$10, engine=$11,
        transmission=$12, condition_notes=$13, announcements=$14, carfax_url=$15, carfax_summary=$16, location=$17, seller_name=$18,
        seller_source=$19, seller_ask=$20, margin_target=$21, closes_at=$22, internal_notes=$23, updated_at=now() WHERE id=$1`,
      [id, ...vals]
    );
    revalidatePath(`/units/${id}`);
    redirect(`/units/${id}`);
  }
  const row = await one(
    `INSERT INTO vehicles (vin, year, make, model, trim, km, exterior, interior, drivetrain, engine, transmission, condition_notes,
      announcements, carfax_url, carfax_summary, location, seller_name, seller_source, seller_ask, margin_target, closes_at, internal_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING id`,
    vals
  );
  await q(`UPDATE vehicles SET code = 'W-' || (1000 + id) WHERE id = $1`, [row.id]);
  redirect(`/units/${row.id}?new=1`);
}

export async function addPhotos(vehicleId, urls) {
  await requireAdmin();
  const start = (await one(`SELECT coalesce(max(sort), -1) + 1 AS n FROM photos WHERE vehicle_id = $1`, [vehicleId])).n;
  for (let i = 0; i < urls.length; i++) await q(`INSERT INTO photos (vehicle_id, url, sort) VALUES ($1,$2,$3)`, [vehicleId, urls[i], start + i]);
  revalidatePath(`/units/${vehicleId}`);
}

export async function deletePhoto(vehicleId, photoId) {
  await requireAdmin();
  await q(`DELETE FROM photos WHERE id = $1 AND vehicle_id = $2`, [photoId, vehicleId]);
  revalidatePath(`/units/${vehicleId}`);
}

export async function makeCover(vehicleId, photoId) {
  await requireAdmin();
  await q(`UPDATE photos SET sort = sort + 1 WHERE vehicle_id = $1`, [vehicleId]);
  await q(`UPDATE photos SET sort = 0 WHERE id = $1 AND vehicle_id = $2`, [photoId, vehicleId]);
  revalidatePath(`/units/${vehicleId}`);
}

export async function setCarfax(vehicleId, url) {
  await requireAdmin();
  await q(`UPDATE vehicles SET carfax_url = $2, updated_at = now() WHERE id = $1`, [vehicleId, url]);
  revalidatePath(`/units/${vehicleId}`);
}

// Send the unit to the chosen dealers by email and/or text.
export async function sendInvites(_prev, fd) {
  await requireAdmin();
  const vehicleId = int(fd.get("vehicle_id"));
  const ids = fd.getAll("contact").map(int).filter(Boolean);
  const useEmail = fd.get("via_email") === "on";
  const useSms = fd.get("via_sms") === "on";
  if (!ids.length) return { error: "Pick at least one dealer." };
  if (!useEmail && !useSms) return { error: "Choose email, text, or both." };
  const v = await one(`SELECT * FROM vehicles WHERE id = $1`, [vehicleId]);
  if (!v.closes_at || new Date(v.closes_at) < new Date()) return { error: "The close time has passed. Extend it first." };
  const photo = (await one(`SELECT url FROM photos WHERE vehicle_id = $1 ORDER BY sort, id LIMIT 1`, [vehicleId]))?.url;
  const photoAbs = photo && photo.startsWith("/") ? appUrl() + photo : photo;
  const contacts = await q(`SELECT * FROM contacts WHERE id = ANY($1::int[]) AND NOT archived`, [ids]);

  let emails = 0, texts = 0, failed = 0, skipped = 0, simulated = false;
  for (const c of contacts) {
    const canEmail = useEmail && c.email && c.consent_email && !c.email_opt_out;
    const canSms = useSms && c.phone && c.consent_sms && !c.sms_opt_out;
    if (!canEmail && !canSms) { skipped++; continue; }
    let inv = await one(`SELECT * FROM invitations WHERE vehicle_id = $1 AND contact_id = $2`, [vehicleId, c.id]);
    if (!inv) inv = await one(`INSERT INTO invitations (vehicle_id, contact_id, token) VALUES ($1,$2,$3) RETURNING *`, [vehicleId, c.id, token(16)]);
    if (canEmail) {
      const m = inviteEmail({ v, contact: c, inv, photo: photoAbs });
      const r = await sendEmail({ to: c.email, ...m, contact_id: c.id, vehicle_id: vehicleId, kind: "invite" });
      r.ok ? emails++ : failed++;
      if (r.simulated) simulated = true;
    }
    if (canSms) {
      const r = await sendSms({ to: c.phone, body: inviteSms({ v, inv }), contact_id: c.id, vehicle_id: vehicleId, kind: "invite" });
      r.ok ? texts++ : failed++;
      if (r.simulated) simulated = true;
    }
    await q(`UPDATE invitations SET sent_at = now(), via_email = via_email OR $2, via_sms = via_sms OR $3 WHERE id = $1`, [inv.id, Boolean(canEmail), Boolean(canSms)]);
  }
  await q(`UPDATE vehicles SET status = CASE WHEN status = 'draft' THEN 'live' ELSE status END, first_sent_at = coalesce(first_sent_at, now()), updated_at = now() WHERE id = $1`, [vehicleId]);
  revalidatePath(`/units/${vehicleId}`);
  return { ok: true, emails, texts, failed, skipped, simulated };
}

export async function extendClose(fd) {
  await requireAdmin();
  const id = int(fd.get("id"));
  const d = localToDate(str(fd.get("closes_at")));
  if (d) await q(`UPDATE vehicles SET closes_at = $2, status = CASE WHEN status IN ('closed','no_sale') THEN 'live' ELSE status END, updated_at = now() WHERE id = $1`, [id, d]);
  revalidatePath(`/units/${id}`);
}

export async function closeNow(fd) {
  await requireAdmin();
  const id = int(fd.get("id"));
  await q(`UPDATE vehicles SET closes_at = now(), updated_at = now() WHERE id = $1`, [id]);
  revalidatePath(`/units/${id}`);
}

export async function award(_prev, fd) {
  await requireAdmin();
  const id = int(fd.get("id"));
  const bidId = int(fd.get("bid_id"));
  const buy = int(fd.get("buy_price"));
  const bid = await one(`SELECT * FROM bids WHERE id = $1 AND vehicle_id = $2`, [bidId, id]);
  if (!bid) return { error: "Pick the winning bid." };
  await q(
    `UPDATE vehicles SET status = 'awarded', winning_bid_id = $2, sell_price = $3, buy_price = $4, awarded_at = now(),
       closes_at = least(closes_at, now()), updated_at = now() WHERE id = $1`,
    [id, bidId, bid.amount, buy]
  );
  let notified = false;
  if (fd.get("notify") === "on") {
    const v = await one(`SELECT * FROM vehicles WHERE id = $1`, [id]);
    const c = await one(`SELECT * FROM contacts WHERE id = $1`, [bid.contact_id]);
    if (c.email && c.consent_email && !c.email_opt_out) { await sendEmail({ to: c.email, ...wonEmail({ v, contact: c, amount: bid.amount }), contact_id: c.id, vehicle_id: id, kind: "won" }); notified = true; }
    if (c.phone && c.consent_sms && !c.sms_opt_out) { await sendSms({ to: c.phone, body: wonSms({ v, amount: bid.amount }), contact_id: c.id, vehicle_id: id, kind: "won" }); notified = true; }
    await q(`UPDATE invitations SET notified_result = TRUE WHERE vehicle_id = $1 AND contact_id = $2`, [id, c.id]);
  }
  revalidatePath(`/units/${id}`);
  revalidatePath("/");
  return { ok: true, notified };
}

export async function updateDeal(fd) {
  await requireAdmin();
  const id = int(fd.get("id"));
  await q(`UPDATE vehicles SET buy_price = $2, sell_price = coalesce($3, sell_price), updated_at = now() WHERE id = $1`, [id, int(fd.get("buy_price")), int(fd.get("sell_price"))]);
  revalidatePath(`/units/${id}`);
}

export async function setStatus(fd) {
  await requireAdmin();
  const id = int(fd.get("id"));
  const status = String(fd.get("status"));
  if (!["no_sale", "closed", "live", "draft"].includes(status)) return;
  if (status === "live") {
    await q(`UPDATE vehicles SET status='live', winning_bid_id=NULL, sell_price=NULL, awarded_at=NULL, updated_at=now() WHERE id=$1`, [id]);
  } else {
    await q(`UPDATE vehicles SET status=$2, closes_at = CASE WHEN $2 = 'no_sale' THEN least(closes_at, now()) ELSE closes_at END, updated_at=now() WHERE id=$1`, [id, status]);
  }
  revalidatePath(`/units/${id}`);
}

// A dealer called or texted their number in — enter it for them.
export async function manualBid(_prev, fd) {
  const u = await requireAdmin();
  const id = int(fd.get("id"));
  const contactId = int(fd.get("contact_id"));
  const amount = int(fd.get("amount"));
  if (!contactId || !amount || amount < 100) return { error: "Pick a dealer and enter an amount." };
  let inv = await one(`SELECT * FROM invitations WHERE vehicle_id = $1 AND contact_id = $2`, [id, contactId]);
  if (!inv) inv = await one(`INSERT INTO invitations (vehicle_id, contact_id, token) VALUES ($1,$2,$3) RETURNING *`, [id, contactId, token(16)]);
  await q(`UPDATE bids SET superseded = TRUE WHERE vehicle_id = $1 AND contact_id = $2 AND NOT superseded`, [id, contactId]);
  await q(`INSERT INTO bids (vehicle_id, contact_id, invitation_id, amount, note, entered_by) VALUES ($1,$2,$3,$4,$5,$6)`, [id, contactId, inv.id, amount, str(fd.get("note")), u.name]);
  revalidatePath(`/units/${id}`);
  return { ok: true };
}

export async function deleteVehicle(fd) {
  await requireAdmin();
  await q(`DELETE FROM vehicles WHERE id = $1 AND status = 'draft'`, [int(fd.get("id"))]);
  redirect("/units");
}
