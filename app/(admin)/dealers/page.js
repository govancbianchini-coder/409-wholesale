import Link from "next/link";
import { dealerStats } from "@/lib/stats";
import { ago, phonePretty } from "@/lib/util";

export const dynamic = "force-dynamic";

function reach(c) {
  const out = [];
  if (c.email) out.push(c.consent_email && !c.email_opt_out ? <span key="e" className="tag good">Email</span> : <span key="e" className="tag bad">Email off</span>);
  if (c.phone) out.push(c.consent_sms && !c.sms_opt_out ? <span key="s" className="tag good">Text</span> : <span key="s" className="tag bad">Text off</span>);
  return out;
}

export default async function Dealers({ searchParams }) {
  const sp = await searchParams;
  const term = (sp?.q || "").trim();
  const showArchived = sp?.archived === "1";
  const params = [];
  let where = showArchived ? "c.archived" : "NOT c.archived";
  if (term) {
    params.push(`%${term.toLowerCase()}%`);
    where += ` AND (lower(c.first_name || ' ' || coalesce(c.last_name,'')) LIKE $1 OR lower(c.dealership) LIKE $1 OR lower(coalesce(c.brand,'')) LIKE $1 OR lower(coalesce(c.email,'')) LIKE $1)`;
  }
  const rows = await dealerStats({ where, params, order: "c.dealership, c.first_name" });
  const stores = new Set(rows.map((r) => r.dealership.toLowerCase())).size;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Dealers</h1>
          <p>{rows.length} contacts · {stores} stores</p>
        </div>
        <div className="row wrap">
          <a className="btn" href="/api/export/dealers">Export CSV</a>
          <Link className="btn" href="/dealers/import">Import CSV</Link>
          <Link className="btn primary" href="/intake">Add dealer</Link>
        </div>
      </div>
      <form className="row">
        <input type="search" name="q" defaultValue={term} placeholder="Search name, store, brand, email" />
        <button className="btn">Search</button>
        <Link href={showArchived ? "/dealers" : "/dealers?archived=1"} className="btn sm" style={{ border: 0 }}>{showArchived ? "Active" : "Archived"}</Link>
      </form>
      <div className="card">
        <div className="tbl-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Contact</th><th>Dealership</th><th className="hide-sm">Reach</th>
                <th className="num">Invites</th><th className="num">Views</th><th className="num">Bids</th><th className="num">Wins</th>
                <th className="num hide-sm">Last active</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/dealers/${c.id}`}><b>{c.first_name} {c.last_name}</b></Link>
                    <div className="xs muted">{c.role || "—"}{c.phone ? ` · ${phonePretty(c.phone)}` : ""}</div>
                  </td>
                  <td>{c.dealership}<div className="xs muted">{c.brand || ""}</div></td>
                  <td className="hide-sm">{reach(c)}</td>
                  <td className="num">{c.invites}</td>
                  <td className="num">{c.views}</td>
                  <td className="num">{c.bids}</td>
                  <td className="num">{c.wins}</td>
                  <td className="num hide-sm muted">{ago(c.last_active)}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={8} className="empty">No dealers yet. <Link href="/intake">Add the first one</Link> or import a CSV.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
