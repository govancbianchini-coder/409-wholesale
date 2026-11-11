import Link from "next/link";
import { listTargets, summary, currentWeek, weekStats, PLAN, RANK } from "@/lib/gtm";
import { setStartDate } from "@/lib/gtm-actions";
import { currentUser } from "@/lib/util";
import StoreRow from "@/components/StoreRow";

export const dynamic = "force-dynamic";

export default async function Today({ searchParams }) {
  const sp = await searchParams;
  const user = await currentUser();
  const wk = await currentWeek();
  const week = Number(sp?.week) || wk.week;
  const plan = PLAN.find((p) => p.week === week) || PLAN[0];
  const s = await summary();
  const reps = await weekStats();
  const me = reps.find((r) => r.rep === user?.name) || { week_visits: 0, today_touches: 0, week_signed: 0 };

  // Today's list: the plan's clusters, or on follow-up weeks every signed-but-not-bidding store + overdue next steps.
  let list = [];
  let title = plan.label;
  if (plan.clusters.length) {
    for (const c of plan.clusters) list.push(...(await listTargets({ cluster: c })));
  } else {
    const all = await listTargets();
    list = all.filter((t) => (week === 6 || week === 12) ? (RANK[t.eff] >= 4 && RANK[t.eff] < 5) : (t.eff === "called" || t.eff === "not_interested" || t.eff === "not_contacted"));
    title = week === 6 || week === 12 ? "Signed stores that haven't bid yet" : plan.label;
  }
  const todo = list.filter((t) => RANK[t.eff] < 4 && t.eff !== "not_interested");
  const doneToday = list.filter((t) => t.last_touch && new Date(t.last_touch).toDateString() === new Date().toDateString()).length;
  const pct = list.length ? Math.round(((list.length - todo.length) / list.length) * 100) : 0;

  return (
    <div className="stack">
      <div className="gtm-week">
        <div className="row between">
          <div className="wk">Week {week} of 12{wk.start ? ` · day ${wk.day + 1}` : ""}</div>
          <div className="chips">
            {week > 1 && <Link href={`/gtm?week=${week - 1}`}>‹</Link>}
            {week < 12 && <Link href={`/gtm?week=${week + 1}`}>›</Link>}
          </div>
        </div>
        <h2>{title}</h2>
        <p>{plan.goal}</p>
        {!wk.start && (
          <form action={setStartDate} className="row" style={{ marginTop: 12 }}>
            <input className="field" type="date" name="start_date" required style={{ font: "inherit", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line-2)", background: "var(--surface-2)", color: "var(--ink)" }} />
            <button className="btn sm primary">Set day 1</button>
          </form>
        )}
      </div>

      <div className="grid g3">
        <div className="card stat"><div className="k">You today</div><div className="v">{me.today_touches}</div><div className="s">touches logged</div></div>
        <div className="card stat"><div className="k">You this week</div><div className="v">{me.week_visits}</div><div className="s">store visits · {me.week_signed} signed</div></div>
        <div className="card stat"><div className="k">Network</div><div className="v">{s.signed}<span className="muted" style={{ fontSize: 16 }}>/{s.total}</span></div><div className="s">signed · {s.bidding} bidding</div></div>
      </div>

      {(s.overdue.length > 0 || s.dueToday.length > 0) && (
        <div className="card">
          <div className="hd"><h3>Follow-ups</h3><span className="small muted">{s.overdue.length} overdue · {s.dueToday.length} today</span></div>
          <div className="bd flush" style={{ padding: 8 }}>
            <div className="store-list">
              {[...s.overdue, ...s.dueToday].slice(0, 8).map((t) => <StoreRow key={t.id} t={t} />)}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="hd">
          <h3>This week's route · {list.length} stores</h3>
          <span className="small muted">{todo.length} to go · {doneToday} touched today</span>
        </div>
        <div className="bd" style={{ paddingTop: 12, paddingBottom: 12 }}>
          <div className={`bar ${pct >= 100 ? "good" : ""}`}><i style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="bd flush" style={{ padding: 8 }}>
          <div className="store-list">
            {list.map((t) => <StoreRow key={t.id} t={t} />)}
            {!list.length && <p className="muted" style={{ padding: 12 }}>Nothing on the route this week. Use the Stores tab.</p>}
          </div>
        </div>
      </div>

      <p className="xs muted">Tap a store to log a call or visit. Signed / bidding / sold update on their own from the platform.</p>
    </div>
  );
}
