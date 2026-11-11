import Link from "next/link";
import { unitRows } from "@/lib/stats";
import { money, km, title, when, effectiveStatus, STATUS_LABEL } from "@/lib/util";

export const dynamic = "force-dynamic";

const FILTERS = [["all", "All"], ["submitted", "Needs review"], ["live", "Live"], ["closed", "Awaiting decision"], ["awarded", "Sold"], ["draft", "Drafts"], ["no_sale", "No sale"]];

export default async function Units({ searchParams }) {
  const sp = await searchParams;
  const f = sp?.s || "all";
  const all = await unitRows();
  const rows = all.filter((v) => f === "all" || effectiveStatus(v) === f);
  const count = (s) => all.filter((v) => s === "all" || effectiveStatus(v) === s).length;
  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Units</h1><p>Every car that's been through Overbid.</p></div>
        <Link href="/units/new" className="btn primary">New unit</Link>
      </div>
      <div className="row wrap">
        {FILTERS.map(([k, l]) => (
          <Link key={k} href={k === "all" ? "/units" : `/units?s=${k}`} className={`btn sm ${f === k ? "primary" : ""}`}>{l} <span className="muted" style={{ color: f === k ? "#aaa" : undefined }}>{count(k)}</span></Link>
        ))}
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table className="data">
            <thead><tr><th>Unit</th><th>Status</th><th className="hide-sm">Closes</th><th className="num">Sent</th><th className="num">Viewed</th><th className="num">Bids</th><th className="num">Top bid</th><th className="num hide-sm">Spread</th></tr></thead>
            <tbody>
              {rows.map((v) => {
                const st = effectiveStatus(v);
                const spread = v.sell_price != null && v.buy_price != null ? v.sell_price - v.buy_price : null;
                return (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/units/${v.id}`} className="row" style={{ gap: 12 }}>
                        {v.photo ? <img src={v.photo} className="thumb" alt="" /> : <span className="thumb" />}
                        <span><b>{title(v)}</b><div className="xs muted">{v.code} · {km(v.km)}</div></span>
                      </Link>
                    </td>
                    <td><span className={`pill ${st}`}>{STATUS_LABEL[st]}</span></td>
                    <td className="small hide-sm">{when(v.closes_at)}</td>
                    <td className="num">{v.invites}</td>
                    <td className="num">{v.views}</td>
                    <td className="num">{v.bid_count}</td>
                    <td className="num"><b>{money(st === "awarded" ? v.sell_price : v.top_bid)}</b></td>
                    <td className="num hide-sm">{spread == null ? "—" : money(spread)}</td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={8} className="empty">No units here yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
