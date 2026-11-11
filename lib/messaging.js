import { q } from "./db";
import { appUrl, money, km, title, when } from "./util";

const BIZ = {
  name: "Overbid — a 409 Motor Company platform",
  address: "101 Highland Park Common NE, Airdrie, AB T4A 0X3",
  phone: "403.808.1801",
};

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}
export function smsConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID));
}

async function log(m) {
  await q(
    `INSERT INTO messages (contact_id, vehicle_id, kind, channel, to_addr, subject, body, status, provider_id, error)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [m.contact_id ?? null, m.vehicle_id ?? null, m.kind, m.channel, m.to, m.subject ?? null, m.body ?? null, m.status, m.provider_id ?? null, m.error ?? null]
  );
}

const APP = () => appUrl();
export async function sendEmail({ to, subject, html, text, contact_id, vehicle_id, kind }) {
  if (!emailConfigured()) {
    await log({ contact_id, vehicle_id, kind, channel: "email", to, subject, body: text, status: "simulated" });
    return { ok: true, simulated: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [to],
        reply_to: process.env.EMAIL_REPLY_TO && !process.env.EMAIL_REPLY_TO.includes("409motorco.com") ? process.env.EMAIL_REPLY_TO : "govan@overbid.ca",
        subject,
        html,
        text,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `Resend ${res.status}`);
    await log({ contact_id, vehicle_id, kind, channel: "email", to, subject, body: text, status: "sent", provider_id: data.id });
    return { ok: true };
  } catch (e) {
    await log({ contact_id, vehicle_id, kind, channel: "email", to, subject, body: text, status: "failed", error: String(e.message || e) });
    return { ok: false, error: String(e.message || e) };
  }
}

export async function sendSms({ to, body, contact_id, vehicle_id, kind }) {
  if (!smsConfigured()) {
    await log({ contact_id, vehicle_id, kind, channel: "sms", to, body, status: "simulated" });
    return { ok: true, simulated: true };
  }
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const params = new URLSearchParams({ To: to, Body: body });
    if (process.env.TWILIO_MESSAGING_SERVICE_SID) params.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID);
    else params.set("From", process.env.TWILIO_FROM);
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // 21610 = recipient replied STOP. Respect it permanently.
      if (data?.code === 21610 && contact_id) await q(`UPDATE contacts SET sms_opt_out = TRUE, updated_at = now() WHERE id = $1`, [contact_id]);
      throw new Error(data?.message || `Twilio ${res.status}`);
    }
    await log({ contact_id, vehicle_id, kind, channel: "sms", to, body, status: "sent", provider_id: data.sid });
    return { ok: true };
  } catch (e) {
    await log({ contact_id, vehicle_id, kind, channel: "sms", to, body, status: "failed", error: String(e.message || e) });
    return { ok: false, error: String(e.message || e) };
  }
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function shell(inner, contactToken) {
  const unsub = `${appUrl()}/u/${contactToken}`;
  return `<!doctype html><html><body style="margin:0;background:#f4f2ee;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#17181a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee;padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#0b0f17;padding:18px 24px"><img src="${APP()}/lockup-dark.png" alt="Overbid" width="180" style="display:block;width:180px;height:auto"></td></tr>
${inner}
</table>
<p style="max-width:560px;font-size:11px;line-height:1.5;color:#77736b;margin:16px auto 0">
${esc(BIZ.name)} · ${esc(BIZ.address)} · ${esc(BIZ.phone)}<br>
You're receiving this because you asked to get wholesale units from 409. <a href="${unsub}" style="color:#77736b">Unsubscribe</a>
</p></td></tr></table></body></html>`;
}

export function inviteEmail({ v, contact, inv, photo }) {
  const link = `${appUrl()}/b/${inv.token}`;
  const t = title(v);
  const subject = `Wholesale: ${t} · ${km(v.km)} — bids close ${when(v.closes_at)}`;
  const facts = [
    ["Kilometres", km(v.km)],
    ["Exterior / interior", [v.exterior, v.interior].filter(Boolean).join(" / ") || "—"],
    ["Drivetrain", [v.engine, v.drivetrain].filter(Boolean).join(" · ") || "—"],
    ["VIN", v.vin || "—"],
    ["Location", v.location || "—"],
  ];
  const html = shell(
    `${photo ? `<tr><td><img src="${esc(photo)}" width="560" style="display:block;width:100%;height:auto" alt=""></td></tr>` : ""}
<tr><td style="padding:24px">
<p style="margin:0 0 4px;font-size:14px;color:#77736b">Hi ${esc(contact.first_name)},</p>
<h1 style="margin:0 0 6px;font-size:22px;line-height:1.25">${esc(t)}</h1>
<p style="margin:0 0 18px;font-size:14px;color:#55524c">Bids close <b>${esc(when(v.closes_at))}</b></p>
<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-top:1px solid #ebe8e2">
${facts.map(([k, val]) => `<tr><td style="padding:8px 0;color:#77736b;border-bottom:1px solid #ebe8e2">${k}</td><td align="right" style="padding:8px 0;border-bottom:1px solid #ebe8e2">${esc(val)}</td></tr>`).join("")}
</table>
${v.announcements ? `<p style="margin:16px 0 0;font-size:14px"><b>Announcements:</b> ${esc(v.announcements)}</p>` : ""}
<p style="margin:24px 0 8px"><a href="${link}" style="display:inline-block;background:#ff5a1f;color:#0b0f17;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:600;font-size:15px">${v.report ? "See the market report &amp; bid" : "See photos &amp; put a number on it"}</a></p>
<p style="margin:8px 0 0;font-size:12px;color:#77736b">Bids are blind. ${v.report ? "Full market report with comps, " : ""}photos, condition notes and history are on the page.</p>
</td></tr>`,
    contact.token
  );
  const text = `Hi ${contact.first_name},\n\n${t} · ${km(v.km)}\nBids close ${when(v.closes_at)}\n${v.announcements ? `Announcements: ${v.announcements}\n` : ""}\nSee photos and place your bid: ${link}\n\n${BIZ.name}\n${BIZ.address}\nUnsubscribe: ${appUrl()}/u/${contact.token}`;
  return { subject, html, text };
}

export function inviteSms({ v, inv }) {
  return `Overbid: ${title(v)}, ${km(v.km)}. Bids close ${when(v.closes_at)}. ${v.report ? "Market report & bid:" : "Photos & bid:"} ${appUrl()}/b/${inv.token}  Reply STOP to opt out`;
}

export function wonEmail({ v, contact, amount }) {
  const t = title(v);
  const subject = `You won it: ${t} at ${money(amount)}`;
  const html = shell(
    `<tr><td style="padding:24px">
<p style="margin:0 0 4px;font-size:14px;color:#77736b">Hi ${esc(contact.first_name)},</p>
<h1 style="margin:0 0 10px;font-size:22px">Your number took the ${esc(t)}</h1>
<p style="font-size:15px;line-height:1.55;margin:0 0 12px">Winning bid: <b>${money(amount)}</b>. We'll reach out shortly to sort out the bill of sale, payment and pickup.</p>
<p style="font-size:14px;color:#55524c;margin:0">Questions? Call ${BIZ.phone}.</p>
</td></tr>`,
    contact.token
  );
  const text = `Hi ${contact.first_name}, your bid of ${money(amount)} won the ${t}. We'll be in touch shortly about paperwork, payment and pickup. ${BIZ.phone}`;
  return { subject, html, text };
}

export function wonSms({ v, amount }) {
  return `Overbid: your ${money(amount)} bid won the ${title(v)}. We'll call you shortly to set up paperwork & pickup.`;
}
