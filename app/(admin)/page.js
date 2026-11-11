import Link from "next/link";
import { q, one } from "@/lib/db";
import { unitRows, dealerStats } from "@/lib/stats";
import { money, km, title, when, ago, effectiveStatus, phonePretty } from "@/lib/util";
import { emailConfigured, smsConfigured } from "@/lib/messaging";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const units = await unitRows({ order: "v.closes_at ASC NULLS LAST" });
  const live = units.filter((v) => effectiveStatus(v) === "live");
  const awaiting = units.filter((v) => effectiveStatus(v) === "closed");
  const submitted = units.filter((v) => v.status === "submitted");
  const sold = units.filter((v) => v.status === "awarded").sort((a, b) => new Date(b.awarded_at) - new Date(a.awarded_at));

  const net = await one(`SELECT count(*)::int n, count(DISTINCT lower(dealership))::int stores,
      count(*) FILTER (WHERE (email IS NOT NULL AND consent_email AND NOT email_opt_out) OR (phone IS NOT NULL AND consent_sms AND NOT sms_opt_out))::int reachable,
      count(*) FILTER (WHERE created_at > now() - interval '7 days')::int week
    FROM contacts WHERE NOT archived`);
  const b30 = await one(`SELECT count(*)::int n, count(DISTINCT vehicle_id)::int units FROM bids WHERE NOT superseded AND created_at > now() - interval '30 days'`);
  const inv30 = await one(`SELECT count(*)::int sent, count(*) FILTER (WHERE first_viewed_at IS NOT NULL)::int viewed,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM bids b WHERE b.invitation_id = i.id))::int bid
    FROM invitations i WHERE sent_at > now() - interval '30 days'`);
  const mtd = await one(`SELECT count(*)::int n, coalesce(sum(sell_price - buy_price),0)::int spread, coalesce(sum(sell_price),0)::bigint volume
    FROM vehicles WHERE status = 'awarded' AND awarded_at >= date_trunc('month', now() AT TIME ZONE 'America/Edmonton') AT TIME ZONE 'America/Edmonton'`);
  const allTime = await one(`SELECT count(*)::int n, coalesce(sum(sell_price - buy_price),0)::int spread, round(avg(sell_price - buy_price))::int avg FROM vehicles WHERE status = 'awarded'`);

  const weeks = await q(`
    WITH w AS (SELECT generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') AS wk)
    SELECT w.wk, (SELECT count(*) FROM bids b WHERE NOT superseded AND b.created_at >= w.wk AND b.created_at < w.wk + interval '1 week')::int bids,
      (SELECT coalesce(sum(sell_price - buy_price),0) FROM vehicles v WHERE v.status='awarded' AND v.awarded_at >= w.wk AND v.awarded_at < w.wk + interval '1 week')::int spread
    FROM w ORDER BY w.wk`);
  const maxBids = Math.max(1, ...weeks.map((w) => w.bids));

  const leaders = (await dealerStats({ where: "NOT c.archived", order: "bids DESC, wins DESC, invites DESC", limit: 10 })).filter((d) => d.invites > 0);
  const maxLeaderBids = Math.max(1, ...leaders.map((d) => d.bids));
  const quiet = await q(`SELECT c.id, c.first_name, c.dealership, count(i.id)::int invites FROM contacts c JOIN invitations i ON i.contact_id = c.id AND i.sent_at IS NOT NULL
      WHERE NOT c.archived GROUP BY c.id HAVING count(i.id) >= 3 AND NOT EXISTS (SELECT 1 FROM bids b WHERE b.contact_id = c.id) ORDER BY invites DESC LIMIT 5`);

  const activity = await q(`
    (SELECT 'bid' kind, b.created_at at, c.id cid, c.first_name, c.dealership, v.id vid, v.year, v.make, v.model, v.trim, b.amount, NULL::text body
       FROM bids b JOIN contacts c ON c.id = b.contact_id JOIN vehicles v ON v.id = b.vehicle_id ORDER BY b.created_at DESC LIMIT 20)
    UNION ALL
    (SELECT 'view', i.first_viewed_at, c.id, c.first_name, c.dealership, v.id, v.year, v.make, v.model, v.trim, NULL, NULL
       FROM invitations i JOIN contacts c ON c.id = i.contact_id JOIN vehicles v ON v.id = i.vehicle_id WHERE i.first_viewed_at IS NOT NULL ORDER BY i.first_viewed_at DESC LIMIT 20)
    UNION ALL
    (SELECT 'dealer', c.created_at, c.id, c.first_name, c.dealership, NULL, NULL, NULL, NULL, NULL, NULL, c.created_by FROM contacts c ORDER BY c.created_at DESC LIMIT 10)
    UNION ALL
    (SELECT 'reply', m.created_at, c.id, c.first_name, coalesce(c.dealership, m.to_addr), NULL, NULL, NULL, NULL, NULL, NULL, m.body
       FROM messages m LEFT JOIN contacts c ON c.id = m.contact_id WHERE m.kind = 'reply' ORDER BY m.created_at DESC LIMIT 10)
    ORDER BY at DESC LIMIT 25`);

  const respRate = inv30.sent ? Math.round((inv30.bid / inv30.sent) * 100) : null;
  const viewRate = inv30.sent ? Math.round((inv30.viewed / inv30.sent) * 100) : null;
  const testMode = !emailConfigured() || !smsConfigured();

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Wholesale dashboard</h1><p>Every unit, every bid, every dealer in one place.</p></div>
        <div className="row wrap"><Link href="/intake" className="btn">Add dealer</Link><Link href="/units/new" className="btn primary">New unit</Link></div>
      </div>

      {testMode && (
        <div className="notice warn">
          <b>Test mode.</b> {!emailConfigured() && "Email (Resend) isn't connected. "}{!smsConfigured() && "Texting (Twilio) isn't connected. "}
          Sends are logged but nothing reaches dealers. The setup guide covers the keys.
        </div>
      )}

      <div className="grid g4">
        <div className="card stat"><div className="k">Dealer network</div><div className="v">{net.reachable}</div><div className="s">reachable · {net.n} contacts at {net.stores} stores{net.week ? ` · +${net.week} this week` : ""}</div></div>
        <div className="card stat"><div className="k">On the block</div><div className="v">{live.length}</div><div className="s">live · {awaiting.length} awaiting your decision</div></div>
        <div className="card stat"><div className="k">Bids · 30 days</div><div className="v">{b30.n}</div><div className="s">{b30.units ? `${(b30.n / b30.units).toFixed(1)} per unit` : "—"} · {viewRate == null ? "—" : `${viewRate}% open · ${respRate}% bid`}</div></div>
        <div className="card stat"><div className="k">Spread · this month</div><div className="v">{money(mtd.spread)}</div><div className="s">{mtd.n} sold · {money(mtd.volume)} volume · all-time {money(allTime.spread)}</div></div>
      </div>

      {submitted.length > 0 && (
        <div className="card" style={{ borderColor: "#e8cf9a" }}>
          <div className="hd" style={{ background: "var(--warn-soft)" }}><h2>Dealer call-outs to review</h2><span className="small ink2">Approve to send them out.</span></div>
          <div className="tbl-wrap"><table className="data"><thead><tr><th>Unit</th><th className="hide-sm">Seller</th><th className="num">Photos</th><th className="num hide-sm">Submitted</th><th></th></tr></thead><tbody>
            {submitted.map((v) => (
              <tr key={v.id}><td><Link href={`/units/${v.id}`} className="row" style={{ gap: 10 }}>{v.photo ? <img src={v.photo} className="thumb" alt="" /> : <span className="thumb" />}<span><b>{title(v)}</b><div className="xs muted">{km(v.km)}</div></span></Link></td><td className="hide-sm small">{v.seller_name || "Dealer call-out"}</td><td className="num">{v.photo_count}</td><td className="num hide-sm small muted">{ago(v.submitted_at)}</td><td className="right"><Link href={`/units/${v.id}`} className="btn sm">Review</Link></td></tr>
            ))}
          </tbody></table></div>
        </div>
      )}

      {awaiting.length > 0 && (
        <div className="card" style={{ borderColor: "#e8cf9a" }}>
          <div className="hd" style={{ background: "var(--warn-soft)" }}><h2>Needs your call</h2><span className="small ink2">Bidding closed. Award it or pass.</span></div>
          <div className="tbl-wrap">
            <table className="data">
              <thead><tr><th>Unit</th><th className="num">Bids</th><th className="num">Top bid</th><th className="hide-sm">Top dealer</th><th className="num">Offer seller</th><th className="num hide-sm">Seller wants</th><th></th></tr></thead>
              <tbody>
                {awaiting.map((v) => (
                  <tr key={v.id}>
                    <td><Link href={`/units/${v.id}`} className="row" style={{ gap: 10 }}>{v.photo ? <img src={v.photo} className="thumb" alt="" /> : <span className="thumb" />}<b>{title(v)}</b></Link></td>
                    <td className="num">{v.bid_count}</td>
                    <td className="num"><b>{money(v.top_bid)}</b>{v.second_bid ? <div className="xs muted">2nd {money(v.second_bid)}</div> : null}</td>
                    <td className="hide-sm">{v.top_dealer || "—"}</td>
                    <td className="num">{v.top_bid ? money(v.top_bid - v.margin_target) : "—"}</td>
                    <td className="num hide-sm muted">{money(v.seller_ask)}</td>
                    <td className="right"><Link href={`/units/${v.id}`} className="btn sm">Decide</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid g-main">
        <div className="stack">
          <div className="card">
            <div className="hd"><h2>Live units</h2><Link href="/units?s=live" className="small muted">All units</Link></div>
            <div className="tbl-wrap">
              <table className="data">
                <thead><tr><th>Unit</th><th className="hide-sm">Closes</th><th className="num">Sent</th><th className="num">Viewed</th><th className="num">Bids</th><th className="num">Top bid</th><th className="num hide-sm">Offer seller</th></tr></thead>
                <tbody>
                  {live.map((v) => (
                    <tr key={v.id}>
                      <td><Link href={`/units/${v.id}`} className="row" style={{ gap: 10 }}>{v.photo ? <img src={v.photo} className="thumb" alt="" /> : <span className="thumb" />}<span><b>{title(v)}</b><div className="xs muted">{km(v.km)}</div></span></Link></td>
                      <td className="small hide-sm">{when(v.closes_at)}</td>
                      <td className="num">{v.invites}</td>
                      <td className="num">{v.views}</td>
                      <td className="num">{v.bid_count}</td>
                      <td className="num"><b>{money(v.top_bid)}</b>{v.top_dealer ? <div className="xs muted">{v.top_dealer}</div> : null}</td>
                      <td className="num hide-sm">{v.top_bid ? money(v.top_bid - v.margin_target) : "—"}</td>
                    </tr>
                  ))}
                  {!live.length && <tr><td colSpan={7} className="empty">Nothing live. <Link href="/units/new">Put a unit up</Link>.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="hd"><h2>Dealer leaderboard</h2><Link href="/dealers" className="small muted">All dealers</Link></div>
            <div className="tbl-wrap">
              <table className="data">
                <thead><tr><th>Dealer</th><th>Bids</th><th className="num">Wins</th><th className="num">Win rate</th><th className="num hide-sm">Response</th><th className="num hide-sm">Avg gap when lost</th><th className="num hide-sm">Bought</th></tr></thead>
                <tbody>
                  {leaders.map((d) => (
                    <tr key={d.id}>
                      <td><Link href={`/dealers/${d.id}`}><b>{d.dealership}</b></Link><div className="xs muted">{d.first_name} {d.last_name}</div></td>
                      <td><div className="row" style={{ gap: 8 }}><span className="num small" style={{ width: 20 }}>{d.bids}</span><div className="bar grow" title={`${d.bids} bids`}><i style={{ width: `${(d.bids / maxLeaderBids) * 100}%` }} /></div></div></td>
                      <td className="num">{d.wins}</td>
                      <td className="num">{d.bids ? `${Math.round((d.wins / d.bids) * 100)}%` : "—"}</td>
                      <td className="num hide-sm">{d.invites ? `${Math.round((d.bids / d.invites) * 100)}%` : "—"}</td>
                      <td className="num hide-sm">{d.avg_gap_pct == null ? "—" : `${d.avg_gap_pct}%`}</td>
                      <td className="num hide-sm">{money(d.won_value)}</td>
                    </tr>
                  ))}
                  {!leaders.length && <tr><td colSpan={7} className="empty">Fills in once units go out.</td></tr>}
                </tbody>
              </table>
            </div>
            {quiet.length > 0 && (
              <div className="bd small" style={{ borderTop: "1px solid var(--line)" }}>
                <b>Getting units, not bidding:</b>{" "}
                {quiet.map((d, i) => <span key={d.id}>{i ? ", " : ""}<Link href={`/dealers/${d.id}`}>{d.dealership} ({d.first_name})</Link> {d.invites}×</span>)}
                <span className="muted">. Worth a call, or drop them from the list.</span>
              </div>
            )}
          </div>

          <div className="card">
            <div className="hd"><h2>Recent sales</h2><span className="small muted">{allTime.n} all-time · avg spread {money(allTime.avg)}</span></div>
            <div className="tbl-wrap">
              <table className="data">
                <thead><tr><th>Unit</th><th>Winner</th><th className="num">Sold</th><th className="num">Paid</th><th className="num">Spread</th><th className="num hide-sm">When</th></tr></thead>
                <tbody>
                  {sold.slice(0, 10).map((v) => (
                    <tr key={v.id}>
                      <td><Link href={`/units/${v.id}`}><b>{title(v)}</b></Link></td>
                      <td className="small">{v.winner}</td>
                      <td className="num">{money(v.sell_price)}</td>
                      <td className="num">{money(v.buy_price)}</td>
                      <td className="num"><b>{v.buy_price != null ? money(v.sell_price - v.buy_price) : "—"}</b></td>
                      <td className="num small muted hide-sm">{ago(v.awarded_at)}</td>
                    </tr>
                  ))}
                  {!sold.length && <tr><td colSpan={6} className="empty">No sales yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="hd"><h2>Bids per week</h2><span className="xs muted">last 8 weeks</span></div>
            <div className="bd">
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
                {weeks.map((w) => (
                  <div key={w.wk} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }} title={`Week of ${when(w.wk, { weekday: undefined, hour: undefined, minute: undefined })}: ${w.bids} bids · ${money(w.spread)} spread`}>
                    <span className="xs num ink2" style={{ marginBottom: 3 }}>{w.bids || ""}</span>
                    <div style={{ width: "100%", height: `${Math.max(2, (w.bids / maxBids) * 92)}px`, background: w.bids ? "var(--ink-2)" : "var(--line)", borderRadius: "4px 4px 0 0" }} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 6, borderTop: "1px solid var(--line-2)", paddingTop: 4 }}>
                {weeks.map((w) => <div key={w.wk} className="xs muted" style={{ flex: 1, textAlign: "center" }}>{new Date(w.wk).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" })}</div>)}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="hd"><h2>Activity</h2></div>
            <ul className="feed">
              {activity.map((a, i) => (
                <li key={i}>
                  <span className={`dot ${a.kind}`} />
                  <div className="grow">
                    <div className="small">
                      {a.kind === "bid" && <><b>{a.dealership}</b> bid <b className="num">{money(a.amount)}</b> on <Link href={`/units/${a.vid}`}>{title(a)}</Link></>}
                      {a.kind === "view" && <><b>{a.dealership}</b> opened <Link href={`/units/${a.vid}`}>{title(a)}</Link></>}
                      {a.kind === "dealer" && <><Link href={`/dealers/${a.cid}`}><b>{a.first_name}</b> at {a.dealership}</Link> joined the network{a.body ? ` (added by ${a.body})` : ""}</>}
                      {a.kind === "reply" && <><b>{a.dealership}</b> texted back: “{a.body}”</>}
                    </div>
                    <div className="xs muted">{ago(a.at)}</div>
                  </div>
                </li>
              ))}
              {!activity.length && <li className="muted small">Quiet so far.</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
