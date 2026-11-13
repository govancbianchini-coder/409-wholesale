"use client";
import { useActionState, useState } from "react";
import { acceptOffer, passOffer } from "@/lib/dealer";

const fmt = (n) => "$" + Number(n).toLocaleString("en-CA");

export default function SellerDecision({ vehicleId, net }) {
  const [a, acceptAction, accepting] = useActionState(acceptOffer, null);
  const [p, passAction, passing] = useActionState(passOffer, null);
  const [showPass, setShowPass] = useState(false);
  if (a?.ok) return <div className="notice good"><b>Accepted.</b> {fmt(a.net)} is coming to your store. The buyer pays Overbid first; the settlement sheet below tracks each step.</div>;
  if (p?.ok) return <div className="notice">You passed on this number. We'll give you a call.</div>;
  return (
    <div className="stack-sm">
      {a?.error && <div className="notice bad">{a.error}</div>}
      {p?.error && <div className="notice bad">{p.error}</div>}
      <form action={acceptAction}>
        <input type="hidden" name="id" value={vehicleId} />
        <button className="btn accent block" disabled={accepting || passing} style={{ fontSize: 17, padding: "14px 18px" }}>{accepting ? "Accepting…" : `Accept ${fmt(net)}`}</button>
      </form>
      <div className="xs muted">Accepting sells the unit to the top bidder. The buyer pays Overbid; you're paid before the unit leaves your lot.</div>
      {showPass ? (
        <form action={passAction} className="row">
          <input type="hidden" name="id" value={vehicleId} />
          <input type="text" name="note" placeholder="Optional: what number would work?" />
          <button className="btn sm" disabled={passing}>{passing ? "…" : "Pass"}</button>
        </form>
      ) : (
        <button type="button" className="linkbtn small muted" onClick={() => setShowPass(true)}>Not enough — pass on this number</button>
      )}
    </div>
  );
}
