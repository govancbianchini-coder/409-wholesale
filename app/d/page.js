import { q, one } from "@/lib/db";
import { currentDealer, money, km, title, when, effectiveStatus, STATUS_LABEL, spreadFor } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function DealerHome() {
  const d = await currentDealer();
  const dealership = d.did ? await one(`SELECT * FROM dealerships WHERE id = $1`, [d.did]) : null;

  // Units this dealer has been invited to (live first), with their own bid
  const invited = await q(
    `SELECT v.*, i.token,
       (SELECT url FROM photos p WHERE p.vehicle_id = v.id ORDER BY sort, id LIMIT 1) photo,
       (SELECT amount FROM bids b WHERE b.vehicle_id = v.id AND b.contact_id = $1 AND NOT superseded) my_bid,
       (SELECT contact_id FROM bids b WHERE b.id = v.winning_bid_id) winner_id
     FROM invitations i JOIN vehicles v ON v.id = i.vehicle_id
     WHERE i.contact_id = $1 AND i.sent_at IS NOT NULL ORDER BY v.closes_at DESC`,
    [d.cid]
  );
  const live = invited.filter((v) => effectiveStatus(v) === "live");
  const past = invited.filter((v) => effectiveStatus(v) !== "live").slice(0, 10);

  // Units this dealer called out
  const mine = await q(
    `SELECT v.*, (SELECT url FROM photos p WHERE p.vehicle_id = v.id ORDER BY sort, id LIMIT 1) photo,
       (SELECT count(*) FROM photos p WHERE p.vehicle_id = v.id AND p.slot IS NOT NULL)::int shots,
       (SELECT count(*) FROM bids b WHERE b.vehicle_id = v.id AND NOT superseded)::int bid_count,
       (SELECT max(amount) FROM bids b WHERE b.vehicle_id = v.id AND NOT superseded) top_bid
     FROM vehicles v WHERE v.submitted_by = $1 ORDER BY v.created_at DESC LIMIT 20`,
    [d.cid]
  );

  const stLabel = (v) => {
    const st = effectiveStatus(v);
    if (v.status === "draft" && v.submitted_by) return "Photos needed";
    return STATUS_LABEL[st] || st;
  };

  return (
    <div className="stack">
      {!dealership?.pref_makes?.length && (
        <div className="notice"><b>Tell us what you buy.</b> Pick the brands you want to be called on so the right units reach you. <a href="/d/prefs">Set preferences →</a></div>
      )}

      <div className="row between"><h2>Units to bid on</h2><span className="small muted">{live.length} live</span></div>
      {live.map((v) => (
        <a key={v.id} className="unit-card" href={`/b/${v.token}`}>
          {v.photo ? <img className="ph" src={v.photo} alt="" /> : <span className="ph" />}
          <div className="grow">
            <div className="t">{title(v)}</div>
            <div className="small ink2">{km(v.km)} · closes {when(v.closes_at)}</div>
            <div className="small">{v.my_bid ? <span className="tag good">Your bid {money(v.my_bid)}</span> : <span className="tag accent">No bid yet</span>}</div>
          </div>
        </a>
      ))}
      {!live.length && <div className="card"><div className="empty">Nothing live for you right now. Units that match your brands will land here, plus a text or email.</div></div>}

      <div className="row between" style={{ marginTop: 10 }}><h2>Your call-outs</h2><a href="/d/callout/new" className="btn sm primary">Call out a unit</a></div>
      {mine.map((v) => {
        const st = effectiveStatus(v);
        const href = v.status === "draft" && v.submitted_by ? `/d/callout/${v.id}/photos` : `/d/callout/${v.id}`;
        return (
          <a key={v.id} className="unit-card" href={href}>
            {v.photo ? <img className="ph" src={v.photo} alt="" /> : <span className="ph" />}
            <div className="grow">
              <div className="t">{title(v)}</div>
              <div className="small ink2">{km(v.km)} · {v.code}</div>
              <div className="small">
                <span className={`pill ${st}`}>{stLabel(v)}</span>
                {st === "awarded" && v.top_bid ? <span className="tag good" style={{ marginLeft: 6 }}>Overbid's number {money(v.top_bid - spreadFor(v.top_bid))}</span> : null}
                {st === "live" ? <span className="tag" style={{ marginLeft: 6 }}>{v.bid_count} bid{v.bid_count === 1 ? "" : "s"} so far</span> : null}
              </div>
            </div>
          </a>
        );
      })}
      {!mine.length && <div className="card"><div className="empty">Got a trade you'd rather not keep? <a href="/d/callout/new">Call it out</a> — scan the VIN, take the photos, and the network bids on it.</div></div>}

      {past.length > 0 && (
        <>
          <h2 style={{ marginTop: 10 }}>Past units</h2>
          <div className="card"><div className="tbl-wrap"><table className="data">
            <thead><tr><th>Unit</th><th className="num">Your bid</th><th>Result</th></tr></thead>
            <tbody>{past.map((v) => (
              <tr key={v.id}><td><a href={`/b/${v.token}`}>{title(v)}</a><div className="xs muted">{km(v.km)}</div></td><td className="num">{money(v.my_bid)}</td><td className="small">{v.winner_id === d.cid ? <b>Won</b> : v.status === "awarded" ? "Sold elsewhere" : v.my_bid ? "Closed" : "—"}</td></tr>
            ))}</tbody>
          </table></div></div>
        </>
      )}
    </div>
  );
}
