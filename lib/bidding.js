"use server";
import { revalidatePath } from "next/cache";
import { q, one } from "./db";
import { int, str, money, title, appUrl } from "./util";
import { sendEmail, sendSms } from "./messaging";

export async function placeBid(_prev, fd) {
  const tok = String(fd.get("token") || "");
  const amount = int(fd.get("amount"));
  const note = str(fd.get("note"))?.slice(0, 500) || null;
  if (fd.get("agree") !== "on") return { error: "Please confirm you agree to the bid terms." };
  const inv = await one(`SELECT * FROM invitations WHERE token = $1`, [tok]);
  if (!inv) return { error: "This link isn't valid." };
  const v = await one(`SELECT * FROM vehicles WHERE id = $1`, [inv.vehicle_id]);
  if (v.status !== "live" || !v.closes_at || new Date(v.closes_at) < new Date()) return { error: "Bidding on this unit has closed." };
  if (!amount || amount < 500) return { error: "Enter your number in dollars." };
  if (amount > 2000000) return { error: "That number looks off. Check for an extra zero." };

  const prev = await one(`SELECT amount FROM bids WHERE vehicle_id = $1 AND contact_id = $2 AND NOT superseded`, [v.id, inv.contact_id]);
  await q(`UPDATE bids SET superseded = TRUE WHERE vehicle_id = $1 AND contact_id = $2 AND NOT superseded`, [v.id, inv.contact_id]);
  await q(`INSERT INTO bids (vehicle_id, contact_id, invitation_id, amount, note) VALUES ($1,$2,$3,$4,$5)`, [v.id, inv.contact_id, inv.id, amount, note]);

  // Optional heads-up to 409
  const c = await one(`SELECT first_name, last_name, dealership FROM contacts WHERE id = $1`, [inv.contact_id]);
  const top = await one(`SELECT max(amount) m FROM bids WHERE vehicle_id = $1 AND NOT superseded`, [v.id]);
  const line = `${prev ? "Revised" : "New"} bid ${money(amount)} on ${title(v)} from ${c.dealership} (${c.first_name}). Top is now ${money(top.m)}.`;
  if (process.env.ALERT_EMAIL) {
    const link = `${appUrl()}/units/${v.id}`;
    await sendEmail({ to: process.env.ALERT_EMAIL, subject: line, text: `${line}\n${link}`, html: `<p>${line}</p><p><a href="${link}">Open unit</a></p>`, vehicle_id: v.id, kind: "alert" });
  }
  if (process.env.ALERT_SMS) await sendSms({ to: process.env.ALERT_SMS, body: `409W: ${line}`, vehicle_id: v.id, kind: "alert" });

  revalidatePath(`/b/${tok}`);
  return { ok: true, amount, revised: Boolean(prev) };
}
