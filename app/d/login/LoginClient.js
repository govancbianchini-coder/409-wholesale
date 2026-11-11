"use client";
import { useActionState } from "react";
import { requestCode, verifyCode } from "@/lib/dealer";

export default function LoginClient({ next }) {
  const [req, reqAction, reqPending] = useActionState(requestCode, null);
  const [ver, verAction, verPending] = useActionState(verifyCode, null);

  if (req?.ok) {
    return (
      <div className="stack" style={{ marginTop: 40 }}>
        <div><h1>Check your {req.sent}</h1><p className="ink2" style={{ margin: "6px 0 0" }}>If we have <b>{req.masked}</b> on file, a 6-digit code is on its way. It expires in 10 minutes.</p></div>
        <form action={verAction} className="card"><div className="bd stack">
          {ver?.error && <div className="notice bad">{ver.error}</div>}
          <input type="hidden" name="id" value={req.masked} />
          <input type="hidden" name="next" value={next} />
          <input type="text" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="code-input" placeholder="••••••" autoFocus required />
          <button className="btn primary lg block" disabled={verPending}>{verPending ? "Checking…" : "Sign in"}</button>
        </div></form>
        <p className="small muted">Didn't get it? Check spam, or <a href="/d/login">try again</a>. Not on Overbid yet? Ask Govan or Kevin at 409 for an invite link.</p>
      </div>
    );
  }
  return (
    <div className="stack" style={{ marginTop: 40 }}>
      <div><h1>Dealer sign-in</h1><p className="ink2" style={{ margin: "6px 0 0" }}>No password. We'll text or email you a code.</p></div>
      <form action={reqAction} className="card"><div className="bd stack">
        {req?.error && <div className="notice bad">{req.error}</div>}
        <label className="f"><span>Your email or cell number</span><input type="text" name="id" inputMode="email" autoCapitalize="none" autoComplete="username" placeholder="you@dealer.com or 403 555 0123" autoFocus required /></label>
        <button className="btn primary lg block" disabled={reqPending}>{reqPending ? "Sending…" : "Send me a code"}</button>
      </div></form>
      <p className="xs muted">Overbid, a 409 Motor Company platform · 403.808.1801</p>
    </div>
  );
}
