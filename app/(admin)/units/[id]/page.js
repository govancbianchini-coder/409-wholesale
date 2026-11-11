import Link from "next/link";
import { notFound } from "next/navigation";
import { q } from "@/lib/db";
import { unitRows } from "@/lib/stats";
import { money, km, title, when, ago, int, effectiveStatus, STATUS_LABEL, appUrl, TZ } from "@/lib/util";
import { sendInvites, award, manualBid, extendClose, closeNow, setStatus, updateDeal, deleteVehicle } from "@/lib/units";
import { PhotoManager, SendPanel, AwardPanel, ManualBid } from "@/components/UnitPanels";
import { emailConfigured, smsConfigured } from "@/lib/messaging";
import MarketReport from "@/components/MarketReport";

export const dynamic = "force-dynamic";

function toLocalInput(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export default async function Unit({ params, searchParams }) {
  const { id: raw } = await params;
  const sp = await searchParams;
  const id = int(raw);
  const [v] = await unitRows({ where: "v.id = $1", params: [id] });
  if (!v) notFound();
  const st = effectiveStatus(v);
  const photos = await q(`SELECT * FROM photos WHERE vehicle_id = $1 ORDER BY sort, id`, [id]);

  // Current bids (latest per dealer), highest first
  const bids = await q(
    `SELECT b.*, c.first_name, c.last_name, c.dealership, c.brand, i.first_viewed_at, i.view_count
     FROM bids b JOIN contacts c ON c.id = b.contact_id LEFT JOIN invitations i ON i.id = b.invitation_id
     WHERE b.vehicle_id = $1 AND NOT b.superseded ORDER BY b.amount DESC, b.created_at`,
    [id]
  );
  const revisions = await q(`SELECT contact_id, count(*)::int n FROM bids WHERE vehicle_id = $1 GROUP BY contact_id`, [id]);
  const revBy = Object.fromEntries(revisions.map((r) => [r.contact_id, r.n]));

  const invites = await q(
    `SELECT i.*, c.first_name, c.last_name, c.dealership,
       EXISTS (SELECT 1 FROM bids b WHERE b.invitation_id = i.id) AS bid
     FROM invitations i JOIN contacts c ON c.id = i.contact_id WHERE i.vehicle_id = $1 ORDER BY i.first_viewed_at DESC NULLS LAST, c.dealership`,
    [id]
  );

  // Recipient targeting: score every reachable dealer against this unit.
  const cands = await q(
    `SELECT c.id, c.first_name, c.last_name, c.dealership, c.brand, c.pref_makes, c.pref_min_price, c.pref_max_price, c.pref_max_km,
       (c.email IS NOT NULL AND c.consent_email AND NOT c.email_opt_out) OR (c.phone IS NOT NULL AND c.consent_sms AND NOT c.sms_opt_out) AS reachable,
       (SELECT count(DISTINCT b.vehicle_id) FROM bids b WHERE b.contact_id = c.id AND NOT b.superseded)::int bids,
       (SELECT count(DISTINCT b.vehicle_id) FROM bids b JOIN vehicles vv ON vv.id = b.vehicle_id WHERE b.contact_id = c.id AND lower(vv.make) = lower($2))::int make_bids,
       (SELECT count(*) FROM vehicles vv JOIN bids b ON b.id = vv.winning_bid_id WHERE b.contact_id = c.id)::int wins,
       i.sent_at IS NOT NULL AS invited, i.first_viewed_at IS NOT NULL AS viewed
     FROM contacts c LEFT JOIN invitations i ON i.contact_id = c.id AND i.vehicle_id = $1
     WHERE NOT c.archived ORDER BY c.dealership`,
    [id, v.make || ""]
  );
  const ref = v.seller_ask;
  const candidates = cands.map((c) => {
    let score = 0;
    const reasons = [];
    const makes = (c.pref_makes || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (makes.length && v.make) {
      if (makes.some((m) => v.make.toLowerCase().includes(m) || m.includes(v.make.toLowerCase()))) { score += 3; reasons.push(`Wants ${v.make}`); }
      else { score -= 1; reasons.push("✕ Other makes"); }
    } else if (c.brand && v.make && c.brand.toLowerCase().includes(v.make.toLowerCase())) { score += 3; reasons.push(`${c.brand} store`); }
    else score += 1;
    if (ref && c.pref_max_price && ref > c.pref_max_price) { score -= 2; reasons.push("✕ Over price range"); }
    if (ref && c.pref_min_price && ref < c.pref_min_price) { score -= 2; reasons.push("✕ Under price range"); }
    if (v.km && c.pref_max_km && v.km > c.pref_max_km) { score -= 2; reasons.push("✕ Too many km"); }
    if (c.make_bids) { score += 2; reasons.push(`★ Bid on ${c.make_bids} ${v.make}`); }
    else if (c.bids) { score += 1; reasons.push(`Active bidder`); }
    if (c.wins) { score += 1; reasons.push(`★ ${c.wins} win${c.wins > 1 ? "s" : ""}`); }
    return { ...c, score, reasons, preselect: c.reachable && !c.invited && score >= 2 };
  }).sort((a, b) => Number(b.reachable) - Number(a.reachable) || b.score - a.score);

  const reachableContacts = cands.filter((c) => !c.archived);
  const top = bids[0];
  const winningBid = bids.find((b) => b.id === v.winning_bid_id);
  const spread = v.sell_price != null && v.buy_price != null ? v.sell_price - v.buy_price : null;
  const testMode = !emailConfigured() || !smsConfigured();

  return (
    <div className="stack">
      {sp?.new && <div className="notice good">Unit created. Add photos, then send it out.</div>}
      <div className="page-head">
        <div className="row" style={{ gap: 16, alignItems: "center" }}>
          {v.photo ? <img src={v.photo} className="thumb lg" alt="" /> : null}
          <div>
            <div className="small"><Link href="/units" className="muted">Units</Link> <span className="muted">/ {v.code}</span></div>
            <h1>{title(v)}</h1>
            <p className="row wrap" style={{ gap: 8 }}><span className={`pill ${st}`}>{STATUS_LABEL[st]}</span> {km(v.km)} {v.vin ? `· ${v.vin}` : ""}</p>
          </div>
        </div>
        <div className="row wrap">
          <Link className="btn" href={`/units/${id}/edit`}>Edit</Link>
          {invites[0] && <a className="btn" href={`/b/${invites[0].token}?preview=1`} target="_blank">Preview dealer page</a>}
        </div>
      </div>

      <div className="grid g4">
        <div className="card stat"><div className="k">Top bid</div><div className="v">{money(top?.amount)}</div><div className="s">{top ? top.dealership : "No bids yet"}</div></div>
        <div className="card stat"><div className="k">Offer seller</div><div className="v">{top ? money(top.amount - v.margin_target) : "—"}</div><div className="s">top bid − {money(v.margin_target)}{v.seller_ask ? ` · wants ${money(v.seller_ask)}` : ""}</div></div>
        <div className="card stat"><div className="k">Bids / views / sent</div><div className="v">{v.bid_count} / {v.views} / {v.invites}</div><div className="s">{v.invites ? `${Math.round((v.bid_count / v.invites) * 100)}% bid rate` : "Not sent yet"}</div></div>
        <div className="card stat"><div className="k">{st === "awarded" ? "Spread to 409" : "Closes"}</div><div className="v" style={{ fontSize: st === "awarded" ? 28 : 18, lineHeight: st === "awarded" ? undefined : "34px" }}>{st === "awarded" ? money(spread) : when(v.closes_at)}</div><div className="s">{st === "awarded" ? `sold ${money(v.sell_price)} · paid ${money(v.buy_price)}` : st === "live" ? "Dealers can still bid" : "Bidding closed"}</div></div>
      </div>

      <div className="grid g-main">
        <div className="stack">
          <div className="card">
            <div className="hd"><h2>Bids</h2><span className="small muted">Blind: dealers never see each other</span></div>
            <div className="tbl-wrap">
              <table className="data">
                <thead><tr><th>#</th><th>Dealer</th><th className="num">Bid</th><th className="num hide-sm">Gap to top</th><th className="hide-sm">Note</th><th className="num">When</th></tr></thead>
                <tbody>
                  {bids.map((b, i) => (
                    <tr key={b.id} className={b.id === v.winning_bid_id ? "hl" : ""}>
                      <td className="muted">{i + 1}</td>
                      <td><Link href={`/dealers/${b.contact_id}`}><b>{b.dealership}</b></Link><div className="xs muted">{b.first_name} {b.last_name}{revBy[b.contact_id] > 1 ? ` · revised ${revBy[b.contact_id] - 1}×` : ""}{b.entered_by ? ` · entered by ${b.entered_by}` : ""}</div></td>
                      <td className="num"><b>{money(b.amount)}</b></td>
                      <td className="num hide-sm muted">{i === 0 ? "—" : `−${money(top.amount - b.amount)}`}</td>
                      <td className="small hide-sm">{b.note || ""}</td>
                      <td className="num small muted">{ago(b.created_at)}</td>
                    </tr>
                  ))}
                  {!bids.length && <tr><td colSpan={6} className="empty">{v.invites ? "Waiting on numbers." : "Send it out to start collecting bids."}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {st !== "awarded" && (
            <div className="card">
              <div className="hd"><h2>Send to dealers</h2>{testMode && <span className="tag accent">Test mode{!emailConfigured() ? " · email" : ""}{!smsConfigured() ? " · text" : ""}</span>}</div>
              <div className="bd">
                {!photos.length && <div className="notice warn" style={{ marginBottom: 14 }}>Add photos first. Dealers bid stronger with a full set.</div>}
                <SendPanel action={sendInvites} vehicleId={id} candidates={candidates} closed={st !== "live" && st !== "draft"} />
              </div>
            </div>
          )}

          <div className="card">
            <div className="hd"><h2>Market report</h2>{v.report_at ? <span className="tag good">Ready · {ago(v.report_at)}</span> : <span className="tag">Not run</span>}</div>
            <div className="bd">
              {v.report?.comps?.length ? (
                <>
                  <div className="small ink2" style={{ marginBottom: 8 }}>This is what dealers see on the bid page.</div>
                  <MarketReport report={v.report} unit={v} />
                </>
              ) : (
                <div className="small ink2">
                  No market report yet. Say <b>“run Overbid research on {v.code}”</b> and the research agent will pull comps from AutoTrader and CarGurus{v.vin ? "" : " (add the VIN first)"} and attach them here.
                  Dealers still get photos, condition and announcements without it.
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="hd"><h2>Photos & history report</h2><span className="small muted">{photos.length} photos</span></div>
            <div className="bd"><PhotoManager vehicleId={id} photos={photos} carfaxUrl={v.carfax_url} /></div>
          </div>

          <div className="card">
            <div className="hd"><h2>Who's looked</h2><span className="small muted">{v.views} of {v.invites} opened the link</span></div>
            <div className="tbl-wrap">
              <table className="data">
                <thead><tr><th>Dealer</th><th>Sent via</th><th className="num">Views</th><th className="num">First viewed</th><th>Bid?</th><th className="hide-sm">Link</th></tr></thead>
                <tbody>
                  {invites.map((i) => (
                    <tr key={i.id}>
                      <td>{i.dealership}<div className="xs muted">{i.first_name} {i.last_name}</div></td>
                      <td className="small">{[i.via_email && "Email", i.via_sms && "Text"].filter(Boolean).join(" + ") || "—"}</td>
                      <td className="num">{i.view_count}</td>
                      <td className="num small muted">{i.first_viewed_at ? ago(i.first_viewed_at) : "—"}</td>
                      <td className="small">{i.bid ? <span className="tag good">Yes</span> : ""}</td>
                      <td className="xs hide-sm"><a href={`${appUrl()}/b/${i.token}?preview=1`} target="_blank" className="muted">Open</a></td>
                    </tr>
                  ))}
                  {!invites.length && <tr><td colSpan={6} className="empty">Not sent to anyone yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="stack">
          {st === "awarded" ? (
            <div className="card">
              <div className="hd"><h2>Sold</h2><span className="pill awarded">Sold</span></div>
              <div className="bd stack-sm small">
                <div>Winner: <b>{v.winner}</b></div>
                <div>Sold to dealer: <b className="num">{money(v.sell_price)}</b></div>
                <div>Paid to seller: <b className="num">{money(v.buy_price)}</b></div>
                <div>Spread: <b className="num">{money(spread)}</b></div>
                <div className="muted">Awarded {when(v.awarded_at)}</div>
                <form action={updateDeal} className="stack-sm" style={{ marginTop: 10 }}>
                  <input type="hidden" name="id" value={id} />
                  <div className="row"><input type="text" inputMode="numeric" name="buy_price" defaultValue={v.buy_price ?? ""} placeholder="Paid to seller" /><input type="text" inputMode="numeric" name="sell_price" defaultValue={v.sell_price ?? ""} placeholder="Sold for" /></div>
                  <button className="btn sm">Update final numbers</button>
                </form>
                <form action={setStatus} style={{ marginTop: 6 }}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="live" /><button className="linkbtn small">Undo award (deal fell through)</button></form>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="hd"><h2>Award</h2></div>
              <div className="bd"><AwardPanel action={award} vehicleId={id} bids={bids.map((b) => ({ id: b.id, amount: b.amount, dealership: b.dealership, first_name: b.first_name }))} margin={v.margin_target} sellerAsk={v.seller_ask} /></div>
            </div>
          )}

          {st !== "awarded" && (
            <div className="card">
              <div className="hd"><h2>Timing</h2></div>
              <div className="bd stack-sm">
                <form action={extendClose} className="row">
                  <input type="hidden" name="id" value={id} />
                  <input type="datetime-local" name="closes_at" defaultValue={toLocalInput(v.closes_at)} />
                  <button className="btn sm">Set</button>
                </form>
                <div className="row wrap">
                  {st === "live" && <form action={closeNow}><input type="hidden" name="id" value={id} /><button className="btn sm">Close bidding now</button></form>}
                  {st !== "no_sale" && st !== "draft" && <form action={setStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="no_sale" /><button className="btn sm danger">Mark no sale</button></form>}
                  {st === "draft" && <form action={deleteVehicle}><input type="hidden" name="id" value={id} /><button className="btn sm danger">Delete draft</button></form>}
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="hd"><h2>Phone-in bid</h2></div>
            <div className="bd"><ManualBid action={manualBid} vehicleId={id} contacts={reachableContacts} /></div>
          </div>

          <div className="card">
            <div className="hd"><h2>Details</h2></div>
            <div className="bd small stack-sm">
              {v.announcements && <div><b>Announcements:</b> {v.announcements}</div>}
              {v.condition_notes && <div><b>Condition:</b> {v.condition_notes}</div>}
              {v.carfax_summary && <div><b>History:</b> {v.carfax_summary}</div>}
              <div className="muted">{[v.exterior, v.interior, v.engine, v.drivetrain, v.transmission].filter(Boolean).join(" · ")}</div>
              <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "10px 0" }} />
              <div><b>Seller:</b> {v.seller_name || "—"} {v.seller_source ? `(${v.seller_source})` : ""}</div>
              <div><b>Seller wants:</b> {money(v.seller_ask)} · <b>Margin target:</b> {money(v.margin_target)}</div>
              {v.internal_notes && <div><b>Internal:</b> {v.internal_notes}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
