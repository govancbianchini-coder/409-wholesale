import Link from "next/link";
import { summary, activity, weekStats, currentWeek, TARGETS, LABEL, PLAN } from "@/lib/gtm";
import { setStartDate } from "@/lib/gtm-actions";
import { ago } from "@/lib/util";

export const dynamic = "force-dynamic";

function Tile({ k, v, target, s }) {
  const pct = target ? Math.min(100, Math.round((v / target) * 100)) : 0;
  return (
    <div className="card stat">
      <div className="k">{k}</div>
      <div className="big" style={{ marginTop: 6 }}>{v}<span className="muted" style={{ fontSize: 14, fontWeight: 500 }}> / {target}</span></div>
      <div className="bar" style={{ marginTop: 10 }}><i style={{ width: `${pct}%`, background: pct >= 100 ? "var(--good)" : undefined }} /></div>
      <div className="target" style={{ marginTop: 6 }}>{s}</div>
    </div>
  );
}

export default async function Board() {
  const s = await summary();
  const wk = await currentWeek();
  const feed = await activity(25);
  const reps = await weekStats();
  const milestone = wk.day < 30 ? 30 : wk.day < 60 ? 60 : 90;
  const T = TARGETS[milestone];
  const plan = PLAN.find((p) => p.week === wk.week);

  return (
    <div className="stack">
      <div className="row between wrap">
        <div>
          <h1 style={{ fontSize: 22 }}>Scoreboard</h1>
          <p className="small ink2" style={{ margin: 0 }}>
            {wk.start ? `Day ${wk.day + 1} · week ${wk.week} · ${plan?.label}` : "Day 1 not set"} · targets shown for day {milestone}
          </p>
        </div>
        <form action={setStartDate} className="row">
          <input type="date" name="start_date" defaultValue={wk.start || ""} style={{ font: "inherit", padding: "7px 10px", borderRadius: 8, border: "1px solid var(--line-2)", background: "var(--surface-2)", color: "var(--ink)" }} />
          <button className="btn sm">Set day 1</button>
        </form>
      </div>

      <div className="grid g4">
        <Tile k="Visited" v={s.visited} target={T.visited} s={`${s.total - s.visited} never visited`} />
        <Tile k="Signed up" v={s.signed} target={T.signed} s={`${s.byStatus.demo} demo'd, not signed`} />
        <Tile k="Bidding" v={s.bidding} target={T.bidding} s={`${s.signed - s.bidding} signed but silent`} />
        <Tile k="Sold a unit" v={s.selling} target={T.selling} s={`${s.byStatus.listed} listed, not sold`} />
      </div>

      <div className="grid g-main">
        <div className="card">
          <div className="hd"><h3>By cluster</h3><span className="xs muted">signed / visited / total</span></div>
          <div className="bd">
            {s.clusters.map((c) => (
              <div key={c.no} className="lead-row" style={{ display: "block" }}>
                <div className="row between">
                  <Link href={`/gtm/stores?c=${c.no}`} style={{ textDecoration: "none" }}><b>{c.no}</b> · {c.name}</Link>
                  <span className="num small">{c.signed} / {c.visited} / {c.total}</span>
                </div>
                <div className="bar" style={{ marginTop: 6, position: "relative" }}>
                  <i style={{ width: `${Math.round((c.visited / c.total) * 100)}%`, background: "var(--line-2)" }} />
                  <i style={{ width: `${Math.round((c.signed / c.total) * 100)}%`, position: "absolute", top: 0, left: 0 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="hd"><h3>Reps this week</h3></div>
            <div className="bd">
              {reps.length ? reps.map((r) => (
                <div key={r.rep} className="lead-row">
                  <span><b>{r.rep}</b><span className="muted xs"> · {r.today_touches} today</span></span>
                  <span className="num small">{r.week_visits} visits · {r.week_signed} signed</span>
                </div>
              )) : <p className="muted small" style={{ margin: 0 }}>No activity logged yet.</p>}
            </div>
          </div>
          <div className="card">
            <div className="hd"><h3>Pipeline</h3></div>
            <div className="bd">
              {Object.entries(s.byStatus).map(([k, n]) => (
                <div key={k} className="lead-row"><span className={`pill ${k}`}>{LABEL[k]}</span><span className="num">{n}</span></div>
              ))}
            </div>
          </div>
          {s.overdue.length > 0 && (
            <div className="card">
              <div className="hd"><h3 style={{ color: "var(--bad)" }}>Overdue follow-ups</h3><span className="xs muted">{s.overdue.length}</span></div>
              <div className="bd">
                {s.overdue.slice(0, 10).map((t) => (
                  <div key={t.id} className="lead-row"><Link href={`/gtm/store/${t.id}`}>{t.dealership}</Link><span className="xs muted">{String(t.next_at).slice(0, 10)} · {t.owner || "—"}</span></div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="hd"><h3>Activity</h3></div>
        <div className="bd">
          <ul className="log">
            {feed.map((l) => (
              <li key={l.id}>
                <Link href={`/gtm/store/${l.target_id}`} style={{ fontWeight: 650 }}>{l.dealership}</Link> · {l.kind}{l.outcome ? ` → ${LABEL[l.outcome]}` : ""}{l.met_with ? ` · ${l.met_with}` : ""}
                {l.note && <div className="ink2 small">{l.note}</div>}
                <div className="m">{l.by_name || "—"} · {ago(l.created_at)}</div>
              </li>
            ))}
            {!feed.length && <li className="muted">Nothing yet. The first logged call shows up here.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
