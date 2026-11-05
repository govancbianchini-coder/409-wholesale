"use client";
import { useActionState, useState } from "react";

function defaultClose() {
  // Next business day at 3:00 PM local
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T15:00`;
}

export default function UnitForm({ action, initial = {} }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [f, setF] = useState({ location: "Airdrie, AB", margin_target: 1500, closes_at: defaultClose(), ...initial });
  const [vinMsg, setVinMsg] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const val = (k) => f[k] ?? "";

  async function decode() {
    setVinMsg("Looking up…");
    const r = await fetch(`/api/vin?vin=${encodeURIComponent(f.vin || "")}`);
    const d = await r.json();
    if (!r.ok) return setVinMsg(d.error);
    setF((x) => {
      const n = { ...x };
      for (const k of ["year", "make", "model", "trim", "engine", "drivetrain", "transmission"]) if (d[k] && !x[k]) n[k] = d[k];
      return n;
    });
    setVinMsg(d.make ? `Decoded: ${d.year} ${d.make} ${d.model}` : "VIN not recognised. Fill it in by hand.");
  }

  const I = (k, label, props = {}) => (
    <label className={`f ${props.full ? "full" : ""}`}>
      <span>{label}</span>
      <input type="text" name={k} value={val(k)} onChange={set(k)} autoComplete="off" {...props} full={undefined} />
    </label>
  );

  return (
    <form action={formAction} className="stack">
      {state?.error && <div className="notice bad">{state.error}</div>}
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="card"><div className="hd"><h2>Vehicle</h2></div><div className="bd stack">
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="f grow"><span>VIN</span><input type="text" name="vin" value={val("vin")} onChange={set("vin")} maxLength={17} style={{ textTransform: "uppercase", fontFamily: "ui-monospace, Menlo, monospace" }} autoComplete="off" /></label>
          <button type="button" className="btn" onClick={decode}>Decode</button>
        </div>
        {vinMsg && <div className="small ink2">{vinMsg}</div>}
        <div className="fgrid">
          {I("year", "Year", { inputMode: "numeric", required: true })}
          {I("make", "Make", { required: true })}
          {I("model", "Model", { required: true })}
          {I("trim", "Trim")}
          {I("km", "Kilometres", { inputMode: "numeric", required: true })}
          {I("exterior", "Exterior colour")}
          {I("interior", "Interior")}
          {I("engine", "Engine")}
          {I("drivetrain", "Drivetrain")}
          {I("transmission", "Transmission")}
          {I("location", "Location", { full: true })}
        </div>
      </div></div>

      <div className="card"><div className="hd"><h2>What dealers see</h2></div><div className="bd stack">
        <label className="f"><span>Announcements <em>(shown up front, e.g. "Prior damage $4,200, out-of-province, 1 key")</em></span><textarea name="announcements" value={val("announcements")} onChange={set("announcements")} /></label>
        <label className="f"><span>Condition notes</span><textarea name="condition_notes" value={val("condition_notes")} onChange={set("condition_notes")} placeholder="Tires, brakes, windshield, paint, interior, options worth noting" /></label>
        <label className="f"><span>History summary <em>(e.g. "CARFAX: 1 owner, no claims, Alberta since new")</em></span><input type="text" name="carfax_summary" value={val("carfax_summary")} onChange={set("carfax_summary")} /></label>
        <label className="f"><span>History report link <em>(or upload the PDF on the next screen)</em></span><input type="text" name="carfax_url" value={val("carfax_url")} onChange={set("carfax_url")} placeholder="https://" /></label>
        <label className="f"><span>Bids close <em>(Calgary time)</em></span><input type="datetime-local" name="closes_at" value={val("closes_at")} onChange={set("closes_at")} required /></label>
      </div></div>

      <div className="card"><div className="hd"><h2>Private to 409</h2><span className="xs muted">Never shown to dealers</span></div><div className="bd fgrid">
        {I("seller_name", "Seller")}
        <label className="f"><span>Source</span>
          <select name="seller_source" value={val("seller_source")} onChange={set("seller_source")}>
            <option value="">—</option><option>Dealer trade-in</option><option>Private seller</option><option>409 inventory</option><option>Auction</option><option>Other</option>
          </select>
        </label>
        {I("seller_ask", "Seller wants", { inputMode: "numeric", placeholder: "$" })}
        {I("margin_target", "409 margin target", { inputMode: "numeric", placeholder: "$1,500" })}
        <label className="f full"><span>Internal notes</span><textarea name="internal_notes" value={val("internal_notes")} onChange={set("internal_notes")} /></label>
      </div></div>

      <div className="row"><button className="btn primary lg" disabled={pending}>{pending ? "Saving…" : initial.id ? "Save changes" : "Create unit → add photos"}</button></div>
    </form>
  );
}
