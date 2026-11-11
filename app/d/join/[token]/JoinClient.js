"use client";
import { useActionState } from "react";
import { joinDealership, verifyCode } from "@/lib/dealer";

export default function JoinClient({ dealership }) {
  const [st, action, pending] = useActionState(joinDealership, null);
  const [ver, verAction, verPending] = useActionState(verifyCode, null);

  if (st?.ok) {
    return (
      <div className="stack" style={{ marginTop: 30 }}>
        <div><h1>Check your {st.sent}</h1><p className="ink2" style={{ margin: "6px 0 0" }}>A 6-digit code went to <b>{st.masked}</b>.</p></div>
        <form action={verAction} className="card"><div className="bd stack">
          {ver?.error && <div className="notice bad">{ver.error}</div>}
          <input type="hidden" name="id" value={st.masked} />
          <input type="text" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="code-input" placeholder="••••••" autoFocus required />
          <button className="btn primary lg block" disabled={verPending}>{verPending ? "Checking…" : "Finish sign-in"}</button>
        </div></form>
      </div>
    );
  }
  return (
    <div className="stack" style={{ marginTop: 30 }}>
      <div><div className="mr-eyebrow">You're invited</div><h1>{dealership.name} on Overbid</h1><p className="ink2" style={{ margin: "6px 0 0" }}>Bid on local wholesale units and call out your own trades. Takes a minute.</p></div>
      <form action={action} className="card"><div className="bd stack">
        {st?.error && <div className="notice bad">{st.error}</div>}
        <input type="hidden" name="token" value={dealership.invite_token} />
        <div className="fgrid">
          <label className="f"><span>First name</span><input type="text" name="first_name" required autoComplete="given-name" /></label>
          <label className="f"><span>Last name</span><input type="text" name="last_name" autoComplete="family-name" /></label>
          <label className="f full"><span>Role</span><input type="text" name="role" placeholder="Used Car Manager" /></label>
          <label className="f"><span>Email</span><input type="email" name="email" inputMode="email" autoCapitalize="none" /></label>
          <label className="f"><span>Cell</span><input type="tel" name="phone" inputMode="tel" placeholder="403 555 0123" /></label>
        </div>
        <label className="check"><input type="checkbox" name="consent" /> <span>Send me units to bid on by email and text. I can opt out any time — every message has an unsubscribe link and texts take STOP.</span></label>
        <button className="btn primary lg block" disabled={pending}>{pending ? "One sec…" : "Join and send my code"}</button>
      </div></form>
      <p className="xs muted">Overbid, a 409 Motor Company platform · 101 Highland Park Common NE, Airdrie AB · <a href="/terms">Bid terms</a></p>
    </div>
  );
}
