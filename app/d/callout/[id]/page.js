import { notFound } from "next/navigation";
import { q, one } from "@/lib/db";
import { currentDealer, int, title, km, money, when, effectiveStatus, spreadFor } from "@/lib/util";
import { withdrawCallout } from "@/lib/dealer";
import SellerDecision from "@/components/SellerDecision";
import Settlement from "@/components/Settlement";
import { sweepClosed } from "@/lib/close";

export const dynamic = "force-dynamic";

export default async function CalloutStatus({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const d = await currentDealer();
  await sweepClosed();
  const v = await one(`SELECT * FROM vehicles WHERE id = $1 AND submitted_by = $2`, [int(id), d.cid]);
  if (!v) notFound();
  const st = effectiveStatus(v);
  const photos = await q(`SELECT url FROM photos WHERE vehicle_id = $1 ORDER BY sort, id`, [v.id]);
  const invites = await one(`SELECT count(*)::int n FROM invitations WHERE vehicle_id = $1 AND sent_at IS NOT NULL`, [v.id]);
  // Anonymous bids: shown only once bidding has closed.
  const closed = ["closed", "awarded", "no_sale"].includes(st);
  const bids = closed ? await q(`SELECT amount FROM bids WHERE vehicle_id = $1 AND NOT superseded ORDER BY amount DESC LIMIT 5`, [v.id]) : [];
  const top = bids[0]?.amount;

  const steps = [
    ["Submitted", true],
    ["Reviewed by Overbid", !["draft", "submitted"].includes(v.status)],
    ["Out to bidders", invites.n > 0],
    ["Bidding closed", closed],
    ["Number ready", Boolean(top)],
    ["Accepted", v.status === "awarded"],
    ["Paid & picked up", Boolean(v.picked_up_at)],
  ];

  return (
    <div className="stack">
      {sp?.submitted && <div className="notice good"><b>Submitted.</b> Overbid reviews every unit before it goes out — usually within the hour during the day. We've emailed you a confirmation; you'll hear again when bidding opens and when your number is ready.</div>}
      <div className="row" style={{ gap: 12 }}>
        {photos[0] ? <img src={photos[0].url} className="thumb lg" alt="" /> : null}
        <div><div className="mr-eyebrow">{v.code}</div><h1 style={{ fontSize: 20 }}>{title(v)}</h1><div className="small ink2">{km(v.km)} · {v.vin}</div></div>
      </div>

      <div className="card"><div className="bd">
        {steps.map(([label, on], i) => (
          <div key={label} className="row" style={{ gap: 10, padding: "6px 0", opacity: on ? 1 : 0.45 }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: on ? "var(--good)" : "var(--line-2)", color: "#fff", fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{on ? "✓" : i + 1}</span>
            <span className={on ? "" : "muted"}>{label}</span>
          </div>
        ))}
        {v.status === "rejected" && <div className="notice warn" style={{ marginTop: 10 }}>Overbid couldn't take this one.{v.review_note ? ` ${v.review_note}` : ""} Call 403.808.1801 if you want to talk it through.</div>}
        {st === "live" && <div className="small ink2" style={{ marginTop: 8 }}>Bidding closes {when(v.closes_at)}. Bids stay sealed until then.</div>}
        {v.status === "no_sale" && <div className="notice" style={{ marginTop: 10 }}>You passed on this number. We'll give you a call about a re-run.</div>}
      </div></div>

      {closed && (
        <div className="card">
          <div className="hd"><h2>Your number</h2>{top ? <span className="small muted">{bids.length} bid{bids.length === 1 ? "" : "s"}</span> : null}</div>
          <div className="bd">
            {top ? (
              <>
                <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em" }} className="num">{money(v.status === "awarded" ? v.buy_price : top - spreadFor(top))}</div>
                <div className="small ink2" style={{ marginBottom: 12 }}>{v.status === "awarded" ? "Accepted. Net to your store." : `Top of ${bids.length} sealed dealer bid${bids.length === 1 ? "" : "s"}, net to you after Overbid's spread. No fees on top. Holds for 7 days.`}</div>
                {bids.map((b, i) => (
                  <div key={i} className={`bidrank ${i === 0 ? "top" : ""}`}><span>Bid {i + 1}{i === 0 ? " · top" : ""}</span><span className="num">{money(b.amount - spreadFor(b.amount))}</span></div>
                ))}
                <div className="xs muted" style={{ margin: "10px 0 14px" }}>Bidders are anonymous. All numbers shown are net to you.</div>
                {st === "closed" && <SellerDecision vehicleId={v.id} net={top - spreadFor(top)} />}
              </>
            ) : (
              <div className="small ink2">No bids came in on this one. It stays in the Save-a-deal market so dealers can still bid later.</div>
            )}
          </div>
        </div>
      )}

      {v.status === "awarded" && <div className="card"><div className="bd"><Settlement v={v} role="seller" /></div></div>}

      {v.dealer_notes && <div className="card"><div className="bd small"><b>Your notes:</b> {v.dealer_notes}</div></div>}
      <div className="photo-grid">{photos.map((p, i) => <div className="ph" key={i}><img src={p.url} alt="" /></div>)}</div>

      {["draft", "submitted"].includes(v.status) && (
        <form action={withdrawCallout}><input type="hidden" name="id" value={v.id} /><button className="linkbtn small muted">Withdraw this unit</button></form>
      )}
    </div>
  );
}
