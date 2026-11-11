"use client";
import { useActionState } from "react";
import { savePrefs } from "@/lib/dealer";

const GROUPS = {
  "German": ["Audi", "BMW", "Mercedes-Benz", "Porsche", "Volkswagen", "MINI"],
  "Japanese": ["Toyota", "Lexus", "Honda", "Acura", "Nissan", "Infiniti", "Mazda", "Subaru", "Mitsubishi"],
  "Korean": ["Hyundai", "Kia", "Genesis"],
  "Domestic": ["Ford", "Lincoln", "Chevrolet", "GMC", "Cadillac", "Buick", "Ram", "Jeep", "Dodge", "Chrysler", "Tesla"],
  "Other": ["Land Rover", "Jaguar", "Volvo", "Alfa Romeo", "Maserati", "Rivian"],
};

export default function PrefsClient({ dealership, me }) {
  const [st, action, pending] = useActionState(savePrefs, null);
  const have = new Set(dealership?.pref_makes || []);
  return (
    <div className="stack">
      <div><h1>{dealership?.name}</h1><p className="ink2" style={{ margin: "4px 0 0" }}>{me.first_name} {me.last_name} · {me.role || "—"} · {me.email || me.phone}</p></div>
      <form action={action} className="card"><div className="bd stack">
        {st?.ok && <div className="notice good">Saved. Units matching these will come to you first.</div>}
        {st?.error && <div className="notice bad">{st.error}</div>}
        <div><h2>Brands you want to be called on</h2><div className="small muted">Tick a whole group or individual brands. Leave everything blank to get everything.</div></div>
        {Object.entries(GROUPS).map(([g, makes]) => (
          <div key={g}>
            <div className="section-title">{g}</div>
            <div className="row wrap" style={{ gap: 8, marginTop: 6 }}>
              {makes.map((m) => (
                <label key={m} className="check" style={{ border: "1px solid var(--line-2)", borderRadius: 999, padding: "6px 10px", gap: 6 }}>
                  <input type="checkbox" name="makes" value={m} defaultChecked={have.has(m)} /> <span>{m}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        <div className="fgrid" style={{ marginTop: 6 }}>
          <label className="f full"><span>Models or types you want <em>(optional)</em></span><input type="text" name="pref_models" defaultValue={dealership?.pref_models || ""} placeholder="e.g. SUVs and trucks only, X5/Q7/GLE, anything AWD" /></label>
          <label className="f"><span>Oldest model year</span><input type="text" inputMode="numeric" name="pref_min_year" defaultValue={dealership?.pref_min_year || ""} placeholder="e.g. 2018" /></label>
          <label className="f"><span>Max km</span><input type="text" inputMode="numeric" name="pref_max_km" defaultValue={dealership?.pref_max_km || ""} placeholder="e.g. 120000" /></label>
          <label className="f"><span>Max price</span><input type="text" inputMode="numeric" name="pref_max_price" defaultValue={dealership?.pref_max_price || ""} placeholder="$" /></label>
        </div>
        <button className="btn primary lg block" disabled={pending}>{pending ? "Saving…" : "Save preferences"}</button>
      </div></form>
      <p className="small"><a href="/d/logout" className="muted">Sign out</a></p>
    </div>
  );
}
