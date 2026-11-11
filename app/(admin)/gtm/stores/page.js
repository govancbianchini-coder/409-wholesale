import Link from "next/link";
import { listTargets, summary, STATUSES } from "@/lib/gtm";
import StoreRow from "@/components/StoreRow";

export const dynamic = "force-dynamic";

export default async function Stores({ searchParams }) {
  const sp = await searchParams;
  const cluster = Number(sp?.c) || null;
  const status = sp?.s || null;
  const term = (sp?.q || "").trim().toLowerCase();
  const s = await summary();
  let rows = await listTargets({ cluster, status });
  if (term) rows = rows.filter((t) => [t.dealership, t.brands, t.grp, t.gm, t.gsm].join(" ").toLowerCase().includes(term));

  const qs = (o) => { const p = new URLSearchParams(); const m = { c: cluster, s: status, q: term, ...o }; for (const k in m) if (m[k]) p.set(k, m[k]); const str = p.toString(); return "/gtm/stores" + (str ? "?" + str : ""); };

  return (
    <div className="stack">
      <form className="row">
        <input name="q" defaultValue={term} placeholder="Search store, brand, group, name" style={{ flex: 1, font: "inherit", padding: "11px 12px", borderRadius: 10, border: "1px solid var(--line-2)", background: "var(--surface)", color: "var(--ink)" }} />
        {cluster && <input type="hidden" name="c" value={cluster} />}
        {status && <input type="hidden" name="s" value={status} />}
        <button className="btn">Go</button>
      </form>
      <div className="chips scroll">
        <Link href={qs({ c: "" })} className={!cluster ? "on" : ""}>All clusters</Link>
        {s.clusters.map((c) => <Link key={c.no} href={qs({ c: c.no })} className={cluster === c.no ? "on" : ""}>{c.no} · {c.name.split(" – ")[1] || c.name} ({c.signed}/{c.total})</Link>)}
      </div>
      <div className="chips scroll">
        <Link href={qs({ s: "" })} className={!status ? "on" : ""}>Any status</Link>
        {STATUSES.map(([k, l]) => <Link key={k} href={qs({ s: k })} className={status === k ? "on" : ""}>{l} ({s.byStatus[k]})</Link>)}
      </div>
      <div className="store-list">
        {rows.map((t) => <StoreRow key={t.id} t={t} />)}
        {!rows.length && <p className="muted">No stores match.</p>}
      </div>
    </div>
  );
}
