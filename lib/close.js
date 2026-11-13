import { q, one } from "./db";
import { appUrl, title, money, spreadFor, when } from "./util";
import { sendEmail, sendSms, sellerNumberEmail, sellerNumberSms } from "./messaging";

// Runs on page loads (admin, dealer portal, bid pages) and from /api/cron/close.
// Finds live units whose bidding has closed and tells the seller + 409 once.
export async function sweepClosed() {
  let rows = [];
  try {
    rows = await q(`SELECT * FROM vehicles WHERE status = 'live' AND closes_at IS NOT NULL AND closes_at < now() AND close_notified_at IS NULL ORDER BY closes_at LIMIT 10`);
  } catch { return 0; }
  let n = 0;
  for (const v of rows) {
    // Claim it first so two concurrent page loads don't both notify.
    const claimed = await one(`UPDATE vehicles SET close_notified_at = now() WHERE id = $1 AND close_notified_at IS NULL RETURNING id`, [v.id]);
    if (!claimed) continue;
    n++;
    const bids = await q(`SELECT b.amount, c.dealership FROM bids b JOIN contacts c ON c.id = b.contact_id WHERE b.vehicle_id = $1 AND NOT b.superseded ORDER BY b.amount DESC`, [v.id]);
    const top = bids[0];
    const line = top
      ? `Bidding closed on ${v.code} ${title(v)}: top ${money(top.amount)} (${top.dealership}) of ${bids.length} bid${bids.length === 1 ? "" : "s"}. Seller nets ${money(top.amount - spreadFor(top.amount))}.`
      : `Bidding closed on ${v.code} ${title(v)} with no bids.`;
    if (process.env.ALERT_EMAIL) {
      const link = `${appUrl()}/units/${v.id}`;
      await sendEmail({ to: process.env.ALERT_EMAIL, subject: line, text: `${line}\n${link}`, html: `<p>${line}</p><p><a href="${link}">Open unit</a></p>`, vehicle_id: v.id, kind: "alert" });
    }
    if (process.env.ALERT_SMS) await sendSms({ to: process.env.ALERT_SMS, body: `Overbid: ${line}`, vehicle_id: v.id, kind: "alert" });
    if (v.submitted_by) {
      const seller = await one(`SELECT * FROM contacts WHERE id = $1`, [v.submitted_by]);
      const net = top ? top.amount - spreadFor(top.amount) : null;
      if (seller?.phone && seller.consent_sms && !seller.sms_opt_out) await sendSms({ to: seller.phone, body: sellerNumberSms({ v, net, count: bids.length }), contact_id: seller.id, vehicle_id: v.id, kind: "callout" });
      if (seller?.email && seller.consent_email && !seller.email_opt_out) await sendEmail({ to: seller.email, ...sellerNumberEmail({ v, contact: seller, net, count: bids.length }), contact_id: seller.id, vehicle_id: v.id, kind: "callout" });
    }
  }
  return n;
}

export const SETTLEMENT_STEPS = [
  ["offer_accepted_at", "Offer accepted", { seller: "You accepted the top bid.", buyer: "Your bid was accepted.", admin: "Seller accepted (or 409 awarded)." }],
  ["buyer_paid_at", "Buyer's funds received by Overbid", { seller: "The buying store pays Overbid, not you. Nothing to do yet.", buyer: "Pay Overbid by EFT or bank draft within 2 business days. Payment details are on the bill of sale we send you.", admin: "Buyer's EFT / draft cleared." }],
  ["seller_paid_at", "Seller paid", { seller: "Overbid pays your store the net number once the buyer's funds clear.", buyer: "Overbid settles with the selling store.", admin: "409 paid the seller the net number." }],
  ["released_at", "Unit released", { seller: "Hand over keys, ownership and the second key set to the buyer's driver.", buyer: "The selling store releases the unit to you after everyone's paid. We'll text you when it's ready.", admin: "Seller cleared to release." }],
  ["picked_up_at", "Picked up", { seller: "Done. The unit has left your lot and you've been paid.", buyer: "Done. The unit is yours.", admin: "Deal complete." }],
];
