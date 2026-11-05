import Link from "next/link";
import { notFound } from "next/navigation";
import ContactForm from "@/components/ContactForm";
import { updateContact, archiveContact } from "@/lib/contacts";
import { dealerStats } from "@/lib/stats";
import { q } from "@/lib/db";
import { money, when, ago, title, phonePretty, int } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function Dealer({ params }) {
  const { id: raw } = await params;
  const id = int(raw);
  const [c] = await dealerStats({ where: "c.id = $1", params: [id] });
  if (!c) notFound();

  const history = await q(
    `SELECT v.id, v.year, v.make, v.model, v.trim, v.km, v.status, v.winning_bid_id, i.sent_at, i.first_viewed_at, i.view_count,
       (SELECT max(amount) FROM bids b WHERE b.vehicle_id = v.id AND b.contact_id = $1 AND NOT superseded) my_bid,
       (SELECT max(amount) FROM bids b WHERE b.vehicle_id = v.id AND NOT superseded) top_bid,
       (SELECT contact_id FROM bids b WHERE b.id = v.winning_bid_id) winner_id
     FROM invitations i JOIN vehicles v ON v.id = i.vehicle_id
     WHERE i.contact_id = $1 ORDER BY coalesce(i.sent_at, i.created_at) DESC`,
    [id]
  );
  const msgs = await q(`SELECT * FROM messages WHERE contact_id = $1 ORDER BY created_at DESC LIMIT 15`, [id]);
  const winRate = c.bids ? Math.round((c.wins / c.bids) * 100) : 0;
  const respRate = c.invites ? Math.round((c.bids / c.invites) * 100) : 0;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="small"><Link href="/dealers" className="muted">Dealers</Link></div>
          <h1>{c.first_name} {c.last_name}</h1>
          <p>{[c.role, c.dealership, c.brand].filter(Boolean).join(" · ")}</p>
        </div>
        <form action={archiveContact}>
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="archived" value={c.archived ? "0" : "1"} />
          <button className="btn sm">{c.archived ? "Restore" : "Archive"}</button>
        </form>
      </div>

      <div className="grid g4">
        <div className="card stat"><div className="k">Response rate</div><div className="v">{respRate}%</div><div className="s">{c.bids} bids on {c.invites} invites</div></div>
        <div className="card stat"><div className="k">Wins</div><div className="v">{c.wins}</div><div className="s">{winRate}% of their bids</div></div>
        <div className="card stat"><div className="k">Bought through us</div><div className="v">{money(c.won_value)}</div><div className="s">winning bids total</div></div>
        <div className="card stat"><div className="k">Avg gap to winner</div><div className="v">{c.avg_gap_pct == null ? "—" : `${c.avg_gap_pct}%`}</div><div className="s">on units they lost</div></div>
      </div>

      <div className="grid g-main">
        <div className="stack">
          <div className="card">
            <div className="hd"><h2>Bid history</h2><span className="small muted">{history.length} units sent</span></div>
            <div className="tbl-wrap">
              <table className="data">
                <thead><tr><th>Unit</th><th>Sent</th><th>Viewed</th><th className="num">Their bid</th><th className="num">Top bid</th><th>Result</th></tr></thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className={h.winner_id === c.id ? "hl" : ""}>
                      <td><Link href={`/units/${h.id}`}>{title(h)}</Link></td>
                      <td className="small muted">{when(h.sent_at, { weekday: undefined })}</td>
                      <td className="small">{h.first_viewed_at ? `${h.view_count}×` : <span className="muted">No</span>}</td>
                      <td className="num">{money(h.my_bid)}</td>
                      <td className="num">{money(h.top_bid)}</td>
                      <td className="small">{h.winner_id === c.id ? <b>Won</b> : h.status === "awarded" ? "Lost" : h.my_bid ? "Pending" : "—"}</td>
                    </tr>
                  ))}
                  {!history.length && <tr><td colSpan={6} className="empty">Not sent any units yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="hd"><h2>Messages</h2></div>
            <ul className="feed">
              {msgs.map((m) => (
                <li key={m.id}><span className="dot" /><div className="grow"><div className="small"><b>{m.channel === "sms" ? "Text" : "Email"}</b> · {m.kind} · <span className={m.status === "failed" ? "" : "muted"}>{m.status}{m.error ? ` — ${m.error}` : ""}</span></div><div className="xs muted">{ago(m.created_at)} · {m.to_addr}</div></div></li>
              ))}
              {!msgs.length && <li className="muted small">Nothing sent yet.</li>}
            </ul>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="hd"><h2>Consent record</h2></div>
            <div className="bd small stack-sm">
              <div>Email: {c.email || "—"} {c.email && (c.email_opt_out ? <span className="tag bad">Unsubscribed</span> : c.consent_email ? <span className="tag good">Opted in</span> : <span className="tag">No consent</span>)}</div>
              <div>Cell: {phonePretty(c.phone)} {c.phone && (c.sms_opt_out ? <span className="tag bad">Replied STOP</span> : c.consent_sms ? <span className="tag good">Opted in</span> : <span className="tag">No consent</span>)}</div>
              <div className="muted">{c.consent_at ? `Recorded ${when(c.consent_at)} by ${c.consent_by || "—"} (${c.consent_method || "—"})` : "No consent recorded."}</div>
              <div className="muted">Added {when(c.created_at)}{c.created_by ? ` by ${c.created_by}` : ""}</div>
            </div>
          </div>
          <div className="card">
            <div className="hd"><h2>Edit</h2></div>
            <div className="bd"><ContactForm action={updateContact} mode="edit" initial={{ ...c, pref_min_price: c.pref_min_price ?? "", pref_max_price: c.pref_max_price ?? "", pref_max_km: c.pref_max_km ?? "" }} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
