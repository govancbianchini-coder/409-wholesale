"use client";
import { useActionState, useEffect, useRef, useState } from "react";

const BRANDS = ["Acura","Audi","BMW","Buick GMC","Cadillac","Chevrolet","Chrysler Dodge Jeep Ram","Ford","Genesis","Honda","Hyundai","Independent","Infiniti","Jaguar Land Rover","Kia","Lexus","Lincoln","Mazda","Mercedes-Benz","MINI","Mitsubishi","Nissan","Porsche","Subaru","Tesla","Toyota","Volkswagen","Volvo","Wholesaler"];
const ROLES = ["Used Car Manager","General Sales Manager","General Manager","Used Car Buyer","Sales Manager","Dealer Principal","Wholesaler"];

export default function ContactForm({ action, initial = {}, mode = "create" }) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef(null);
  const [v, setV] = useState(initial);
  const vals = state?.values || v;

  useEffect(() => {
    if (state?.ok && mode === "create") {
      formRef.current?.reset();
      setV({});
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [state, mode]);

  const d = (k) => vals?.[k] ?? "";
  const chk = (k) => (vals?.[k] === true || vals?.[k] === "on");

  return (
    <form ref={formRef} action={formAction} className="stack" key={state?.ok ? `ok-${state.id || Date.now()}` : "form"}>
      {state?.error && <div className="notice bad">{state.error}</div>}
      {state?.ok && mode === "create" && <div className="notice good">Saved <b>{state.name}</b> at {state.dealership}. Ready for the next one.</div>}
      {state?.ok && mode === "edit" && <div className="notice good">Saved.</div>}
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="section-title">Who</div>
      <div className="fgrid">
        <label className="f"><span>First name</span><input type="text" name="first_name" defaultValue={d("first_name")} required autoComplete="off" /></label>
        <label className="f"><span>Last name</span><input type="text" name="last_name" defaultValue={d("last_name")} autoComplete="off" /></label>
        <label className="f"><span>Dealership</span><input type="text" name="dealership" defaultValue={d("dealership")} required placeholder="e.g. Royal Oak Audi" list="dealerships" autoComplete="off" /></label>
        <label className="f"><span>Brand</span><input type="text" name="brand" defaultValue={d("brand")} list="brands" autoComplete="off" /></label>
        <label className="f full"><span>Role</span><input type="text" name="role" defaultValue={d("role")} list="roles" autoComplete="off" /></label>
      </div>

      <div className="section-title">How to reach them</div>
      <div className="fgrid">
        <label className="f"><span>Email</span><input type="email" name="email" defaultValue={d("email")} inputMode="email" autoCapitalize="none" autoComplete="off" /></label>
        <label className="f"><span>Cell</span><input type="tel" name="phone" defaultValue={d("phone")} inputMode="tel" placeholder="403 555 0123" autoComplete="off" /></label>
      </div>

      <div className="card" style={{ background: "#faf9f6" }}>
        <div className="bd stack-sm">
          <div className="small ink2">Read this to them, or hand them the phone:</div>
          <div className="small" style={{ fontStyle: "italic" }}>
            “Is it OK if 409 Motor Company sends you wholesale units to bid on? You can opt out any time — every message has an unsubscribe link, and you can reply STOP to texts.”
          </div>
          <label className="check"><input type="checkbox" name="consent_email" defaultChecked={chk("consent_email")} /> <span>They agreed to <b>emails</b></span></label>
          <label className="check"><input type="checkbox" name="consent_sms" defaultChecked={chk("consent_sms")} /> <span>They agreed to <b>texts</b></span></label>
          <input type="hidden" name="consent_method" value="In person (verbal)" />
        </div>
      </div>

      <div className="section-title">What they buy <em className="muted" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>— optional, helps target units</em></div>
      <div className="fgrid">
        <label className="f full"><span>Makes they want <em>(comma separated, blank = anything)</em></span><input type="text" name="pref_makes" defaultValue={d("pref_makes")} placeholder="e.g. BMW, Porsche, Mercedes-Benz" autoComplete="off" /></label>
        <label className="f"><span>Min price</span><input type="text" inputMode="numeric" name="pref_min_price" defaultValue={d("pref_min_price")} placeholder="$" /></label>
        <label className="f"><span>Max price</span><input type="text" inputMode="numeric" name="pref_max_price" defaultValue={d("pref_max_price")} placeholder="$" /></label>
        <label className="f"><span>Max km</span><input type="text" inputMode="numeric" name="pref_max_km" defaultValue={d("pref_max_km")} placeholder="e.g. 120000" /></label>
        <label className="f full"><span>Notes</span><textarea name="notes" defaultValue={d("notes")} placeholder="e.g. buys anything AWD under 100k km, prefers texts, best before 11am" /></label>
      </div>

      <button className="btn primary lg block" disabled={pending}>{pending ? "Saving…" : mode === "create" ? "Save dealer" : "Save changes"}</button>

      <datalist id="brands">{BRANDS.map((b) => <option key={b} value={b} />)}</datalist>
      <datalist id="roles">{ROLES.map((b) => <option key={b} value={b} />)}</datalist>
      <datalist id="dealerships" />
    </form>
  );
}
