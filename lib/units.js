"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { q, one } from "./db";
import { token, currentUser, int, str, TZ, appUrl, title } from "./util";
import { sendEmail, sendSms, inviteEmail, inviteSms, wonEmail, wonSms, sellerLiveEmail, sellerLiveSms, sellerSoldEmail } from "./messaging";
import { spreadFor } from "./util";

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
  let v = await one(`SELECT * FROM vehicles WHERE id = $1`, [vehicleId]);
  if (!["submitted", "draft", "live"].includes(v.status)) return { error: "This unit isn't in a state that can be sent." };
  // Bidding window: 2 h is the Overbid promise. "keep" leaves an existing close alone.
  const win = String(fd.get("window") || "2");
  const hours = { "2": 2, "4": 4, "24": 24 }[win];
  if (hours) {
    await q(`UPDATE vehicles SET closes_at = now() + ($2 || ' hours')::interval, close_notified_at = NULL, updated_at = now() WHERE id = $1`, [vehicleId, String(hours)]);
  } else if (!v.closes_at || new Date(v.closes_at) < new Date()) {
    return { error: "The close time has passed. Pick a bidding window." };
  }
  const approving = v.status === "submitted";
  if (approving) await q(`UPDATE vehicles SET status = 'draft', review_note = NULL, updated_at = now() WHERE id = $1`, [vehicleId]);
  v = await one(`SELECT * FROM vehicles WHERE id = $1`, [vehicleId]);
  const photo = (await one(`SELECT url FROM photos WHERE vehicle_id = $1 ORDER BY sort, id LIMIT 1`, [vehicleId]))?.url;
  const photoAbs = photo && photo.startsWith("/") ? appUrl() + photo : photo;
  const sellerName = v.seller_dealership_id ? (await one(`SELECT name FROM dealerships WHERE id = $1`, [v.seller_dealership_id]))?.name : null;
  // The store that called the unit out never bids on it.
  const contacts = (await q(`SELECT * FROM contacts WHERE id = ANY($1::int[]) AND NOT archived`, [ids]))
    .filter((c) => !v.seller_dealership_id || (c.dealership_id !== v.seller_dealership_id && (c.dealership || "").toLowerCase() !== (sellerName || "").toLowerCase()));

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
  // Tell the calling store it's live (first send only).
  const sent = emails + texts;
  if (v.submitted_by && !v.first_sent_at && sent) {
    const seller = await one(`SELECT * FROM contacts WHERE id = $1`, [v.submitted_by]);
    const dealers = (await one(`SELECT count(*)::int n FROM invitations WHERE vehicle_id = $1 AND sent_at IS NOT NULL`, [vehicleId])).n;
    if (seller?.phone && seller.consent_sms && !seller.sms_opt_out) await sendSms({ to: seller.phone, body: sellerLiveSms({ v, dealers }), contact_id: seller.id, vehicle_id: vehicleId, kind: "callout" });
    if (seller?.email && seller.consent_email && !seller.email_opt_out) await sendEmail({ to: seller.email, ...sellerLiveEmail({ v, contact: seller, dealers }), contact_id: seller.id, vehicle_id: vehicleId, kind: "callout" });
  }
  revalidatePath(`/units/${vehicleId}`);
  revalidatePath("/units");
  // The review card unmounts once approved, so carry the result in the URL.
  if (approving) redirect(`/units/${vehicleId}?sent=${emails}&texts=${texts}&failed=${failed}&skipped=${skipped}${simulated ? "&sim=1" : ""}`);
  return { ok: true, emails, texts, failed, skipped, simulated, approved: approving, closes_at: v.closes_at };
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
    const inv = await one(`SELECT token FROM invitations WHERE vehicle_id = $1 AND contact_id = $2`, [id, c.id]);
    const link = inv ? `${appUrl()}/b/${inv.token}` : null;
    if (c.email && c.consent_email && !c.email_opt_out) { await sendEmail({ to: c.email, ...wonEmail({ v, contact: c, amount: bid.amount, link }), contact_id: c.id, vehicle_id: id, kind: "won" }); notified = true; }
    if (c.phone && c.consent_sms && !c.sms_opt_out) { await sendSms({ to: c.phone, body: wonSms({ v, amount: bid.amount }), contact_id: c.id, vehicle_id: id, kind: "won" }); notified = true; }
    await q(`UPDATE invitations SET notified_result = TRUE WHERE vehicle_id = $1 AND contact_id = $2`, [id, c.id]);
  }
  await notifySellerSold(id);
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

// Approve or reject a dealer call-out.
export async function reviewCallout(fd) {
  await requireAdmin();
  const id = int(fd.get("id"));
  const decision = String(fd.get("decision"));
  const v = await one(`SELECT * FROM vehicles WHERE id = $1`, [id]);
  if (!v || v.status !== "submitted") return;
  const seller = v.submitted_by ? await one(`SELECT * FROM contacts WHERE id = $1`, [v.submitted_by]) : null;
  if (decision === "approve") {
    await q(`UPDATE vehicles SET status = 'draft', review_note = NULL, closes_at = greatest(closes_at, now() + interval '1 day'), updated_at = now() WHERE id = $1`, [id]);
    if (seller?.phone && seller.consent_sms && !seller.sms_opt_out) await sendSms({ to: seller.phone, body: `Overbid: your ${title(v)} (${v.code}) is approved and going out to bidders. We'll text you when your number is ready.`, contact_id: seller.id, vehicle_id: id, kind: "callout" });
    else if (seller?.email && seller.consent_email && !seller.email_opt_out) await sendEmail({ to: seller.email, subject: `Approved: ${title(v)} is going out to bidders`, text: `Your ${title(v)} (${v.code}) is approved on Overbid and going out to bidders. We'll let you know when your number is ready.`, html: `<p>Your ${title(v)} (${v.code}) is approved on Overbid and going out to bidders. We'll let you know when your number is ready.</p>`, contact_id: seller.id, vehicle_id: id, kind: "callout" });
  } else {
    const note = str(fd.get("note"));
    await q(`UPDATE vehicles SET status = 'rejected', review_note = $2, updated_at = now() WHERE id = $1`, [id, note]);
    if (seller?.phone && seller.consent_sms && !seller.sms_opt_out) await sendSms({ to: seller.phone, body: `Overbid: we couldn't take the ${title(v)} this time.${note ? " " + note : ""} Call 403.808.1801 with questions.`, contact_id: seller.id, vehicle_id: id, kind: "callout" });
  }
  revalidatePath(`/units/${id}`);
  revalidatePath("/units");
}

// Tell the calling store the unit sold and what they net.
export async function notifySellerSold(vehicleId) {
  const v = await one(`SELECT * FROM vehicles WHERE id = $1`, [vehicleId]);
  if (!v?.submitted_by || v.buy_price == null) return;
  const seller = await one(`SELECT * FROM contacts WHERE id = $1`, [v.submitted_by]);
  const net = v.buy_price;
  if (seller?.phone && seller.consent_sms && !seller.sms_opt_out) await sendSms({ to: seller.phone, body: `Overbid: your ${title(v)} is sold at ${money(net)} net to you. Buyer pays Overbid first, then we pay you, then release. Settlement: ${appUrl()}/d/callout/${vehicleId}`, contact_id: seller.id, vehicle_id: vehicleId, kind: "callout" });
  if (seller?.email && seller.consent_email && !seller.email_opt_out) await sendEmail({ to: seller.email, ...sellerSoldEmail({ v, contact: seller, net }), contact_id: seller.id, vehicle_id: vehicleId, kind: "callout" });
}

// Settlement checklist (admin ticks each step).
export async function setSettlement(fd) {
  await requireAdmin();
  const id = int(fd.get("id"));
  const step = String(fd.get("step"));
  const on = fd.get("on") === "1";
  if (!["offer_accepted_at", "buyer_paid_at", "seller_paid_at", "released_at", "picked_up_at"].includes(step)) return;
  await q(`UPDATE vehicles SET ${step} = ${on ? "now()" : "NULL"}, updated_at = now() WHERE id = $1`, [id]);
  const v = await one(`SELECT * FROM vehicles WHERE id = $1`, [id]);
  // Nudge the right party when a step that affects them flips on.
  if (on && v.winning_bid_id) {
    const buyer = await one(`SELECT c.*, i.token FROM bids b JOIN contacts c ON c.id = b.contact_id LEFT JOIN invitations i ON i.vehicle_id = b.vehicle_id AND i.contact_id = c.id WHERE b.id = $1`, [v.winning_bid_id]);
    const seller = v.submitted_by ? await one(`SELECT * FROM contacts WHERE id = $1`, [v.submitted_by]) : null;
    const t = title(v);
    if (step === "released_at" && buyer) {
      const msg = `Overbid: the ${t} is paid and released. Your driver can pick it up at the selling store — details on your settlement sheet: ${appUrl()}/b/${buyer.token}`;
      if (buyer.phone && buyer.consent_sms && !buyer.sms_opt_out) await sendSms({ to: buyer.phone, body: msg, contact_id: buyer.id, vehicle_id: id, kind: "won" });
      else if (buyer.email && buyer.consent_email && !buyer.email_opt_out) await sendEmail({ to: buyer.email, subject: `Released for pickup: ${t}`, text: msg, html: `<p>${msg}</p>`, contact_id: buyer.id, vehicle_id: id, kind: "won" });
    }
    if (step === "seller_paid_at" && seller) {
      const msg = `Overbid: ${money(v.buy_price)} for the ${t} has been sent to your store. Release the unit to the buyer's driver when they arrive. ${appUrl()}/d/callout/${id}`;
      if (seller.phone && seller.consent_sms && !seller.sms_opt_out) await sendSms({ to: seller.phone, body: msg, contact_id: seller.id, vehicle_id: id, kind: "callout" });
      else if (seller.email && seller.consent_email && !seller.email_opt_out) await sendEmail({ to: seller.email, subject: `Paid: ${t}`, text: msg, html: `<p>${msg}</p>`, contact_id: seller.id, vehicle_id: id, kind: "callout" });
    }
  }
  revalidatePath(`/units/${id}`);
}
