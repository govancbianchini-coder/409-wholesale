"use client";
import { useActionState } from "react";
import { sendTest } from "@/lib/units";

export default function TestSend({ channel, placeholder }) {
  const [s, action, pending] = useActionState(sendTest, null);
  return (
    <form action={action} className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="channel" value={channel} />
      <input type="text" name="to" placeholder={placeholder} style={{ maxWidth: 220 }} />
      <button className="btn sm" disabled={pending}>{pending ? "Sending…" : channel === "sms" ? "Send test text" : "Send test email"}</button>
      {s?.ok && <span className="small" style={{ color: "var(--good)" }}>{s.simulated ? "Logged only — keys not set yet." : `Sent to ${s.to}.`}</span>}
      {s?.error && <span className="small" style={{ color: "var(--bad)" }}>{s.error}</span>}
    </form>
  );
}
