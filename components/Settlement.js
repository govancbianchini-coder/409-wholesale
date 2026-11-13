import { SETTLEMENT_STEPS } from "@/lib/close";
import { money, when } from "@/lib/util";

// Settlement sheet shared by seller (/d/callout), buyer (/b/token) and admin. `role` picks the wording and the price shown.
export default function Settlement({ v, role, winner }) {
  const price = role === "seller" ? v.buy_price : v.sell_price;
  const doneCount = SETTLEMENT_STEPS.filter(([k]) => v[k]).length;
  return (
    <div className="settle">
      <div className="settle-head">
        <div>
          <div className="mr-eyebrow">Settlement sheet · {v.code}</div>
          <div className="settle-price num">{money(price)}</div>
          <div className="small ink2">{role === "seller" ? "Net to your store. No fees on top." : role === "buyer" ? "Payable to Overbid (409 Performance Cars Ltd.) by EFT or bank draft." : `Buyer pays ${money(v.sell_price)} · seller gets ${money(v.buy_price)} · spread ${money((v.sell_price ?? 0) - (v.buy_price ?? 0))}`}</div>
        </div>
        <div className="settle-progress">{doneCount} of {SETTLEMENT_STEPS.length}</div>
      </div>
      <ol className="settle-steps">
        {SETTLEMENT_STEPS.map(([k, label, text], i) => {
          const on = Boolean(v[k]);
          const current = !on && SETTLEMENT_STEPS.slice(0, i).every(([kk]) => v[kk]);
          return (
            <li key={k} className={on ? "on" : current ? "now" : ""}>
              <span className="dot">{on ? "✓" : i + 1}</span>
              <div>
                <div className="lbl">{label}{on ? <span className="xs muted"> · {when(v[k])}</span> : null}</div>
                <div className="small ink2">{text[role] || text.admin}</div>
              </div>
            </li>
          );
        })}
      </ol>
      {role !== "admin" && (
        <div className="xs muted" style={{ marginTop: 10 }}>
          {role === "buyer" ? "Pickup at the selling store once released. Bring a dealer plate and the bill of sale." : winner ? `Buyer: ${winner}. ` : ""}
          Questions: 403.808.1801 · govan@overbid.ca
        </div>
      )}
    </div>
  );
}
