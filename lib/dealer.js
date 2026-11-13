"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { q, one } from "./db";
import { DEALER_COOKIE, sign } from "./session";
import { token, int, str, phoneE164, currentDealer, appUrl, title, money, spreadFor, effectiveStatus } from "./util";
import { sendEmail, sendSms, sellerReceivedEmail, sellerReceivedSms, sellerSoldEmail, wonEmail, wonSms } from "./messaging";
import { SHOTS } from "./shots";


function sixDigits() { return String(Math.floor(100000 + Math.random() * 900000)); }

// Step 1: dealer enters email or cell → we send a code.
export async function requestCode(_prev, fd) {
  const raw = str(fd.get("id"));
  if (!raw) return { error: "Enter the email or cell number we have on file for you." };
  const email = raw.includes("@") ? raw.toLowerCase() : null;
  const phone = email ? null : phoneE164(raw);
  if (!email && !phone) return { error: "That doesn't look like an email or a 10-digit cell number." };
  const c = email
    ? await one(`SELECT * FROM contacts WHERE lower(email) = $1 AND NOT archived`, [email])
    : await one(`SELECT * FROM contacts WHERE phone = $1 AND NOT archived`, [phone]);
  // Don't reveal whether the contact exists.
  if (!c) return { ok: true, sent: email ? "email" : "text", masked: raw };
  const code = sixDigits();
  await q(`INSERT INTO login_codes (contact_id, code, channel, expires_at) VALUES ($1,$2,$3, now() + interval '10 minutes')`, [c.id, code, email ? "email" : "sms"]);
  if (email) {
    await sendEmail({ to: c.email, subject: `${code} is your Overbid sign-in code`, text: `Your Overbid sign-in code is ${code}. It expires in 10 minutes.`, html: `<p style="font-family:sans-serif">Your Overbid sign-in code is <b style="font-size:22px;letter-spacing:.1em">${code}</b>. It expires in 10 minutes.</p>`, contact_id: c.id, kind: "login" });
  } else {
    await sendSms({ to: c.phone, body: `Overbid sign-in code: ${code} (expires in 10 min)`, contact_id: c.id, kind: "login" });
  }
  return { ok: true, sent: email ? "email" : "text", masked: raw, cid: c.id };
}

// Step 2: code → session cookie.
export async function verifyCode(_prev, fd) {
  const raw = str(fd.get("id")) || "";
  const code = (str(fd.get("code")) || "").replace(/\D/g, "");
  const next = str(fd.get("next")) || "/d";
  const email = raw.includes("@") ? raw.toLowerCase() : null;
  const phone = email ? null : phoneE164(raw);
  const c = email
    ? await one(`SELECT * FROM contacts WHERE lower(email) = $1 AND NOT archived`, [email])
    : await one(`SELECT * FROM contacts WHERE phone = $1 AND NOT archived`, [phone]);
  const row = c && await one(`SELECT id FROM login_codes WHERE contact_id = $1 AND code = $2 AND used_at IS NULL AND expires_at > now() ORDER BY id DESC LIMIT 1`, [c.id, code]);
  if (!row) return { error: "That code didn't work. Codes expire after 10 minutes — request a new one." };
  await q(`UPDATE login_codes SET used_at = now() WHERE id = $1`, [row.id]);
  await q(`UPDATE contacts SET last_login_at = now() WHERE id = $1`, [c.id]);
  // Make sure the contact has a dealership record (older contacts added by Kevin may not).
  let did = c.dealership_id;
  if (!did) {
    let d = await one(`SELECT id FROM dealerships WHERE lower(name) = lower($1)`, [c.dealership]);
    if (!d) d = await one(`INSERT INTO dealerships (name, brand, invite_token) VALUES ($1,$2,$3) RETURNING id`, [c.dealership, c.brand, token(10)]);
    did = d.id;
    await q(`UPDATE contacts SET dealership_id = $2 WHERE id = $1`, [c.id, did]);
  }
  const ck = await cookies();
  ck.set(DEALER_COOKIE, await sign("dealer", c.first_name, { cid: c.id, did }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90 });
  redirect(next.startsWith("/d") ? next : "/d");
}

// Join via a dealership's invite link: creates the contact (with consent) and sends a code.
export async function joinDealership(_prev, fd) {
  const tok = str(fd.get("token"));
  const d = await one(`SELECT * FROM dealerships WHERE invite_token = $1 AND status = 'active'`, [tok]);
  if (!d) return { error: "This invite link isn't valid any more." };
  const first = str(fd.get("first_name")), last = str(fd.get("last_name")), role = str(fd.get("role"));
  const email = str(fd.get("email"))?.toLowerCase() || null;
  const phone = phoneE164(str(fd.get("phone")));
  if (!first) return { error: "First name is required." };
  if (!email && !phone) return { error: "Add an email or a cell number." };
  if (fd.get("consent") !== "on") return { error: "Please agree to receive units by email/text — that's how bidding works." };
  let c = email ? await one(`SELECT * FROM contacts WHERE lower(email) = $1`, [email]) : null;
  if (!c && phone) c = await one(`SELECT * FROM contacts WHERE phone = $1`, [phone]);
  if (c) {
    await q(`UPDATE contacts SET dealership_id = $2, archived = FALSE, consent_email = consent_email OR $3, consent_sms = consent_sms OR $4, consent_at = coalesce(consent_at, now()), consent_method = coalesce(consent_method, 'Self-registered via invite link'), updated_at = now() WHERE id = $1`, [c.id, d.id, Boolean(email), Boolean(phone)]);
  } else {
    c = await one(
      `INSERT INTO contacts (token, first_name, last_name, dealership, brand, role, email, phone, consent_email, consent_sms, consent_at, consent_by, consent_method, dealership_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),$11,'Self-registered via invite link',$12,'invite') RETURNING *`,
      [token(12), first, last, d.name, d.brand, role, email, phone, Boolean(email), Boolean(phone), first, d.id]
    );
  }
  const fd2 = new FormData(); fd2.set("id", email || phone);
  return requestCode(null, fd2);
}

export async function dealerLogout() {
  const ck = await cookies();
  ck.set(DEALER_COOKIE, "", { path: "/", maxAge: 0 });
  redirect("/d/login");
}

export async function savePrefs(_prev, fd) {
  const d = await currentDealer();
  if (!d?.did) return { error: "Not signed in." };
  const makes = fd.getAll("makes").map(String).filter(Boolean);
  await q(`UPDATE dealerships SET pref_makes = $2, pref_models = $3, pref_min_year = $4, pref_max_km = $5, pref_max_price = $6 WHERE id = $1`,
    [d.did, makes.length ? makes : null, str(fd.get("pref_models")), int(fd.get("pref_min_year")), int(fd.get("pref_max_km")), int(fd.get("pref_max_price"))]);
  // mirror onto the contact so the existing targeting keeps working
  await q(`UPDATE contacts SET pref_makes = $2, pref_max_km = $3, pref_max_price = $4, updated_at = now() WHERE dealership_id = $1`, [d.did, makes.join(", ") || null, int(fd.get("pref_max_km")), int(fd.get("pref_max_price"))]);
  revalidatePath("/d");
  return { ok: true };
}

// ===== Call-out flow =====

export async function startCallout(_prev, fd) {
  const d = await currentDealer();
  if (!d) return { error: "Not signed in." };
  const vin = (str(fd.get("vin")) || "").toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return { error: "VIN should be 17 characters (no I, O or Q)." };
  const year = int(fd.get("year")), make = str(fd.get("make")), model = str(fd.get("model")), km = int(fd.get("km"));
  if (!year || !make || !model) return { error: "Year, make and model are required — try Decode." };
  if (!km) return { error: "Kilometres are required." };
  const existing = await one(`SELECT id FROM vehicles WHERE vin = $1 AND submitted_by = $2 AND status IN ('submitted','draft')`, [vin, d.cid]);
  if (existing) redirect(`/d/callout/${existing.id}/photos`);
  const row = await one(
    `INSERT INTO vehicles (vin, year, make, model, trim, km, exterior, interior, engine, drivetrain, transmission, status, submitted_by, seller_dealership_id, seller_source, closes_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft',$12,$13,'Dealer call-out', now() + interval '2 hours') RETURNING id`,
    [vin, year, make, model, str(fd.get("trim")), km, str(fd.get("exterior")), str(fd.get("interior")), str(fd.get("engine")), str(fd.get("drivetrain")), str(fd.get("transmission")), d.cid, d.did]
  );
  await q(`UPDATE vehicles SET code = 'W-' || (1000 + id) WHERE id = $1`, [row.id]);
  redirect(`/d/callout/${row.id}/photos`);
}

async function ownCallout(id) {
  const d = await currentDealer();
  if (!d) return null;
  return one(`SELECT * FROM vehicles WHERE id = $1 AND submitted_by = $2`, [id, d.cid]);
}

export async function saveSlotPhoto(vehicleId, slot, url) {
  const v = await ownCallout(vehicleId);
  if (!v || !SHOTS.some(([s]) => s === slot)) throw new Error("Not allowed");
  const sort = SHOTS.findIndex(([s]) => s === slot);
  await q(`DELETE FROM photos WHERE vehicle_id = $1 AND slot = $2`, [vehicleId, slot]);
  await q(`INSERT INTO photos (vehicle_id, url, sort, slot) VALUES ($1,$2,$3,$4)`, [vehicleId, url, sort, slot]);
  revalidatePath(`/d/callout/${vehicleId}/photos`);
}

export async function submitCallout(_prev, fd) {
  const id = int(fd.get("id"));
  const v = await ownCallout(id);
  if (!v) return { error: "Not allowed." };
  const have = (await q(`SELECT slot FROM photos WHERE vehicle_id = $1 AND slot IS NOT NULL`, [id])).map((p) => p.slot);
  const missing = SHOTS.filter(([s]) => !have.includes(s)).map(([, l]) => l);
  if (missing.length) return { error: `Still need ${missing.length} photo${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.` };
  await q(`UPDATE vehicles SET dealer_notes = $2, announcements = coalesce(announcements, $2), status = 'submitted', submitted_at = now(), updated_at = now() WHERE id = $1`, [id, str(fd.get("notes"))]);
  // Confirmation to the calling store
  const d = await currentDealer();
  const seller = await one(`SELECT * FROM contacts WHERE id = $1`, [d.cid]);
  const vv = { ...v, dealer_notes: str(fd.get("notes")) };
  if (seller?.email && seller.consent_email && !seller.email_opt_out) await sendEmail({ to: seller.email, ...sellerReceivedEmail({ v: vv, contact: seller, photos: have.length }), contact_id: seller.id, vehicle_id: id, kind: "callout" });
  if (seller?.phone && seller.consent_sms && !seller.sms_opt_out) await sendSms({ to: seller.phone, body: sellerReceivedSms({ v: vv, photos: have.length }), contact_id: seller.id, vehicle_id: id, kind: "callout" });
  // Heads-up to 409
  const line = `New call-out ${v.code}: ${title(v)}, ${v.km?.toLocaleString("en-CA")} km`;
  if (process.env.ALERT_EMAIL) await sendEmail({ to: process.env.ALERT_EMAIL, subject: line, text: `${line}\n${appUrl()}/units/${id}`, html: `<p>${line}</p><p><a href="${appUrl()}/units/${id}">Review it</a></p>`, vehicle_id: id, kind: "alert" });
  if (process.env.ALERT_SMS) await sendSms({ to: process.env.ALERT_SMS, body: `Overbid: ${line}. Review: ${appUrl()}/units/${id}`, vehicle_id: id, kind: "alert" });
  revalidatePath("/d");
  redirect(`/d/callout/${id}?submitted=1`);
}

export async function withdrawCallout(fd) {
  const id = int(fd.get("id"));
  const v = await ownCallout(id);
  if (!v || !["draft", "submitted"].includes(v.status)) return;
  await q(`DELETE FROM vehicles WHERE id = $1`, [id]);
  revalidatePath("/d");
  redirect("/d");
}

// ===== Seller decision after close =====

// Seller accepts the top bid: awards it, notifies the winner and 409, opens the settlement sheet.
export async function acceptOffer(_prev, fd) {
  const id = int(fd.get("id"));
  const v = await ownCallout(id);
  if (!v) return { error: "Not allowed." };
  if (effectiveStatus(v) !== "closed") return { error: v.status === "awarded" ? "Already accepted." : "Bidding hasn't closed yet." };
  const top = await one(`SELECT b.*, c.first_name, c.email, c.phone, c.consent_email, c.consent_sms, c.email_opt_out, c.sms_opt_out, c.token AS ctoken FROM bids b JOIN contacts c ON c.id = b.contact_id WHERE b.vehicle_id = $1 AND NOT b.superseded ORDER BY b.amount DESC, b.created_at LIMIT 1`, [id]);
  if (!top) return { error: "There are no bids to accept." };
  const net = top.amount - spreadFor(top.amount);
  const upd = await one(
    `UPDATE vehicles SET status = 'awarded', winning_bid_id = $2, sell_price = $3, buy_price = $4, awarded_at = now(), offer_accepted_at = now(), updated_at = now()
     WHERE id = $1 AND status = 'live' RETURNING *`,
    [id, top.id, top.amount, net]
  );
  if (!upd) return { error: "Couldn't accept — refresh and try again." };
  // Winner
  const inv = await one(`SELECT token FROM invitations WHERE vehicle_id = $1 AND contact_id = $2`, [id, top.contact_id]);
  const link = inv ? `${appUrl()}/b/${inv.token}` : null;
  const buyer = { first_name: top.first_name, token: top.ctoken };
  if (top.email && top.consent_email && !top.email_opt_out) await sendEmail({ to: top.email, ...wonEmail({ v: upd, contact: buyer, amount: top.amount, link }), contact_id: top.contact_id, vehicle_id: id, kind: "won" });
  if (top.phone && top.consent_sms && !top.sms_opt_out) await sendSms({ to: top.phone, body: wonSms({ v: upd, amount: top.amount }), contact_id: top.contact_id, vehicle_id: id, kind: "won" });
  await q(`UPDATE invitations SET notified_result = TRUE WHERE vehicle_id = $1 AND contact_id = $2`, [id, top.contact_id]);
  // Receipt to the seller
  const seller = await one(`SELECT * FROM contacts WHERE id = $1`, [v.submitted_by]);
  if (seller?.email && seller.consent_email && !seller.email_opt_out) await sendEmail({ to: seller.email, ...sellerSoldEmail({ v: upd, contact: seller, net }), contact_id: seller.id, vehicle_id: id, kind: "callout" });
  // 409
  const line = `Seller accepted ${upd.code} ${title(upd)}: sold ${money(top.amount)}, seller nets ${money(net)}, spread ${money(top.amount - net)}. Send the buyer the bill of sale.`;
  if (process.env.ALERT_EMAIL) await sendEmail({ to: process.env.ALERT_EMAIL, subject: line, text: `${line}\n${appUrl()}/units/${id}`, html: `<p>${line}</p><p><a href="${appUrl()}/units/${id}">Open unit</a></p>`, vehicle_id: id, kind: "alert" });
  if (process.env.ALERT_SMS) await sendSms({ to: process.env.ALERT_SMS, body: `Overbid: ${line}`, vehicle_id: id, kind: "alert" });
  revalidatePath(`/d/callout/${id}`);
  revalidatePath(`/units/${id}`);
  revalidatePath("/d");
  return { ok: true, net };
}

// Seller passes on the number.
export async function passOffer(_prev, fd) {
  const id = int(fd.get("id"));
  const v = await ownCallout(id);
  if (!v) return { error: "Not allowed." };
  if (effectiveStatus(v) !== "closed") return { error: "Bidding hasn't closed yet." };
  const note = str(fd.get("note"));
  await q(`UPDATE vehicles SET status = 'no_sale', settlement_note = $2, updated_at = now() WHERE id = $1 AND status = 'live'`, [id, note ? `Seller passed: ${note}` : "Seller passed"]);
  const line = `Seller passed on ${v.code} ${title(v)}${note ? ` — "${note}"` : ""}. Worth a call.`;
  if (process.env.ALERT_EMAIL) await sendEmail({ to: process.env.ALERT_EMAIL, subject: line, text: `${line}\n${appUrl()}/units/${id}`, html: `<p>${line}</p><p><a href="${appUrl()}/units/${id}">Open unit</a></p>`, vehicle_id: id, kind: "alert" });
  revalidatePath(`/d/callout/${id}`);
  revalidatePath(`/units/${id}`);
  revalidatePath("/d");
  return { ok: true };
}
