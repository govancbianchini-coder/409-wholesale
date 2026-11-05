"use client";
import Link from "next/link";
import { useActionState } from "react";
import { importContacts } from "@/lib/contacts";

export default function Import() {
  const [state, action, pending] = useActionState(importContacts, null);
  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <div className="page-head">
        <div>
          <div className="small"><Link href="/dealers" className="muted">Dealers</Link></div>
          <h1>Import dealers from CSV</h1>
          <p>For a list Kevin kept in a spreadsheet, or contacts you already have.</p>
        </div>
      </div>
      <div className="card">
        <form action={action} className="bd stack">
          {state?.error && <div className="notice bad">{state.error}</div>}
          {state?.ok && (
            <div className="notice good">
              Added {state.added}. {state.skipped?.length ? `Skipped ${state.skipped.length}:` : ""}
              {state.skipped?.length > 0 && <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{state.skipped.map((s, i) => <li key={i}>{s}</li>)}</ul>}
            </div>
          )}
          <label className="f"><span>CSV file</span><input type="file" name="file" accept=".csv,text/csv" required /></label>
          <div className="small ink2">
            First row must be headers. Recognised columns: <code>first_name, last_name, dealership, brand, role, email, phone, consent_email, consent_sms, pref_makes, notes</code>.
            Put <code>yes</code> in the consent columns only if that person actually agreed. Without it they're saved but won't be messaged.
          </div>
          <div><button className="btn primary" disabled={pending}>{pending ? "Importing…" : "Import"}</button></div>
        </form>
      </div>
    </div>
  );
}
