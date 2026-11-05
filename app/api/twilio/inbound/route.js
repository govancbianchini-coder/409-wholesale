import crypto from "node:crypto";
import { q } from "@/lib/db";
import { appUrl } from "@/lib/util";

export const runtime = "nodejs";

// Twilio "A message comes in" webhook. Tracks STOP / START so the dashboard knows who opted out.
// (Twilio also blocks delivery to STOP'd numbers on its side.)
function validSignature(req, params) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;
  const url = `${appUrl()}/api/twilio/inbound`;
  const data = Object.keys(params).sort().reduce((s, k) => s + k + params[k], url);
  const expected = crypto.createHmac("sha1", token).update(data).digest("base64");
  const got = req.headers.get("x-twilio-signature") || "";
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

export async function POST(req) {
  const form = await req.formData();
  const params = Object.fromEntries(form.entries());
  if (!validSignature(req, params)) return new Response("Forbidden", { status: 403 });
  const from = String(params.From || "");
  const body = String(params.Body || "").trim().toUpperCase();
  if (/^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT|ARRET|ARRÊT)$/.test(body)) {
    await q(`UPDATE contacts SET sms_opt_out = TRUE, updated_at = now() WHERE phone = $1`, [from]);
  } else if (/^(START|UNSTOP|YES)$/.test(body)) {
    await q(`UPDATE contacts SET sms_opt_out = FALSE, updated_at = now() WHERE phone = $1`, [from]);
  }
  await q(
    `INSERT INTO messages (contact_id, kind, channel, to_addr, body, status) VALUES ((SELECT id FROM contacts WHERE phone = $1 LIMIT 1), 'reply', 'sms', $1, $2, 'received')`,
    [from, String(params.Body || "")]
  );
  return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
}
