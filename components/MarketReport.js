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
  const comps = report.comps;
  const hasDays = comps.some((c) => c.days != null);
  const hasDist = comps.some((c) => c.distance_km != null);
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
        {st.avg_days_listed != null && <Tile k="Avg days listed" v={st.avg_days_listed} s="across the set" />}
        {st.cbb_wholesale && <Tile k="CBB" v={money(st.cbb_wholesale)} s={st.cbb_retail ? `wholesale · retail ${money(st.cbb_retail)}` : "wholesale"} />}
      </div>

      {report.search_notes && <p className="small ink2" style={{ margin: "10px 0 0" }}>{report.search_notes}</p>}

      <div className="mr-sub">Comparable vehicles <span className="muted">· sorted by km{hasDist ? ", distance from Airdrie" : ""}</span></div>
      <div className="tbl-wrap">
        <table className="data mr-table">
          <thead>
            <tr>
              <th>Yr</th><th>Colour</th><th className="num">Km</th><th className="num">Price</th>
              {hasDays && <th className="num">Days</th>}
              <th>Seller</th>
              {hasDist && <th className="num">Dist (km)</th>}
            </tr>
          </thead>
          <tbody>
            {comps.map((c, i) => (
              <tr key={i}>
                <td>{c.year ?? "—"}</td>
                <td>{c.colour || "—"}</td>
                <td className="num">{c.km != null ? c.km.toLocaleString("en-CA") : "—"}</td>
                <td className="num"><b>{money(c.price)}</b></td>
                {hasDays && <td className="num">{c.days ?? "—"}</td>}
                <td>{c.url ? <a href={c.url} target="_blank" rel="noopener">{c.seller || c.source || "Listing"}</a> : (c.seller || "—")}{c.city ? <span className="muted"> · {c.city}</span> : null}</td>
                {hasDist && <td className="num">{c.distance_km != null ? c.distance_km.toLocaleString("en-CA") : "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {report.summary && (
        <>
          <div className="mr-sub">Market read</div>
          <p className="small" style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{report.summary}</p>
        </>
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
