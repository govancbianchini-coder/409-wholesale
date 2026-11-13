import { money, km } from "@/lib/util";

function Tile({ k, v, s }) {
  return (
    <div className="mr-tile">
      <div className="k">{k}</div>
      <div className="v">{v ?? "—"}</div>
      {s && <div className="s">{s}</div>}
    </div>
  );
}

// Dealer-facing market report: comps, stats, history. Never any 409 numbers.
export default function MarketReport({ report, unit, compact = false }) {
  if (!report || !report.comps?.length) return null;
  const st = report.stats || {};
  const comps = [...report.comps].sort((a, b) => ((a.distance_km ?? 9e9) - (b.distance_km ?? 9e9)) || ((a.km ?? 9e9) - (b.km ?? 9e9)));
  const hasDays = comps.some((c) => c.days != null);
  const hasDist = comps.some((c) => c.distance_km != null);
  const radius = report.radius_km || 1000;
  const local = comps.filter((c) => c.distance_km != null && c.distance_km <= radius);
  const gen = report.generated_at ? new Date(report.generated_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <section className="mr">
      <div className="mr-head">
        <div>
          <div className="mr-eyebrow">Market data</div>
          <h3>Market report</h3>
        </div>
        <div className="xs muted right">{gen ? `Pulled ${gen}` : ""}{report.sources?.length ? <><br />{report.sources.join(" · ")}</> : null}</div>
      </div>

      <div className="mr-tiles">
        <Tile k={`Within ${(report.radius_km || 1000).toLocaleString("en-CA")} km`} v={st.local_count ?? 0} s={st.local_avg_price ? `avg ${money(st.local_avg_price)} · ${km(st.local_avg_km)}` : "no local comps"} />
        <Tile k="National set" v={st.national_count ?? comps.length} s={st.national_avg_price ? `avg ${money(st.national_avg_price)} · ${km(st.national_avg_km)}` : null} />
        {report.days_supply != null && <Tile k="Market days supply" v={report.days_supply} s="time to sell at today's pace" />}
        {st.avg_days_listed != null && <Tile k="Avg days listed" v={st.avg_days_listed} s="across the set" />}
        {st.cbb_wholesale && <Tile k="CBB" v={money(st.cbb_wholesale)} s={st.cbb_retail ? `wholesale · retail ${money(st.cbb_retail)}` : "wholesale"} />}
      </div>

      {report.search_notes && <p className="small ink2" style={{ margin: "10px 0 0" }}>{report.search_notes}</p>}

      <div className="mr-sub">Comparable vehicles <span className="muted">· nearest first{hasDist ? ", distance from Airdrie" : ""}</span></div>
      <div className="tbl-wrap">
        <table className="data mr-table">
          <thead>
            <tr>
              {hasDist && <th className="num">Dist (km)</th>}
              <th>Yr</th><th className="num">Km</th><th className="num">Price</th>
              {hasDays && <th className="num">Days</th>}
              <th>Seller</th><th>Colour</th>
            </tr>
          </thead>
          <tbody>
            {comps.map((c, i) => (
              <tr key={i} className={c.distance_km != null && c.distance_km <= radius ? "local" : ""}>
                {hasDist && <td className="num c-dist">{c.distance_km != null ? c.distance_km.toLocaleString("en-CA") : "—"}</td>}
                <td className="c-yr">{c.year ?? "—"}</td>
                <td className="num c-km">{c.km != null ? c.km.toLocaleString("en-CA") : "—"}</td>
                <td className="num c-price"><b>{money(c.price)}</b></td>
                {hasDays && <td className="num c-days">{c.days ?? "—"}</td>}
                <td className="c-seller">{c.url ? <a href={c.url} target="_blank" rel="noopener">{c.seller || c.source || "Listing"}</a> : (c.seller || "—")}{c.city ? <span className="muted"> · {c.city}</span> : null}</td>
                <td className="c-colour">{c.colour || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(report.summary || local.length > 0) && (
        <>
          <div className="mr-sub">Market read</div>
          {local.length > 0 && (
            <ul className="small mr-notes mr-local">
              {local.map((c, i) => (
                <li key={i}>
                  <b>{c.seller || "Dealer"}</b>{c.city ? `, ${c.city}` : ""} · {c.distance_km.toLocaleString("en-CA")} km away — {c.year} {c.trim || ""}, {c.km != null ? c.km.toLocaleString("en-CA") + " km" : "km n/a"}, asking <b>{money(c.price)}</b>{c.days != null ? ` · ${c.days} days listed` : ""}{c.url ? <> · <a href={c.url} target="_blank" rel="noopener">listing</a></> : null}
                </li>
              ))}
            </ul>
          )}
          {report.summary && <p className="small" style={{ margin: local.length ? "10px 0 0" : 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{report.summary}</p>}
        </>
      )}

      {(report.recon?.length > 0 || report.notes?.length > 0) && (
        <div className="mr-grid2">
          {report.recon?.length > 0 && (
            <div>
              <div className="mr-sub">Estimated recon to retail standard</div>
              <table className="data mr-table mr-recon"><tbody>
                {report.recon.map((r, i) => <tr key={i}><td>{r.item}</td><td className="num">{r.est != null ? money(r.est) : "—"}</td></tr>)}
                {report.recon_total ? <tr><td><b>Total</b></td><td className="num"><b>{money(report.recon_total)}</b></td></tr> : null}
              </tbody></table>
              <p className="xs muted" style={{ margin: "6px 0 0" }}>Estimate from photos and notes; confirm on inspection.</p>
            </div>
          )}
          {report.notes?.length > 0 && (
            <div>
              <div className="mr-sub">What we noted on the car</div>
              <ul className="small mr-notes">{report.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {report.my_take && (
        <div className="mr-take">
          <div className="mr-eyebrow">Overbid's take</div>
          <p className="small" style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{report.my_take}</p>
        </div>
      )}

      {(report.carfax?.summary || report.carfax?.url || unit?.carfax_url) && (
        <div className="mr-carfax">
          <div><b>Vehicle history</b>{report.carfax?.summary ? <div className="small ink2">{report.carfax.summary}</div> : unit?.carfax_summary ? <div className="small ink2">{unit.carfax_summary}</div> : null}</div>
          {(report.carfax?.url || unit?.carfax_url) && <a className="btn sm" href={report.carfax?.url || unit.carfax_url} target="_blank" rel="noopener">View report</a>}
        </div>
      )}
    </section>
  );
}
