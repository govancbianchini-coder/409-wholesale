import Link from "next/link";
import { notFound } from "next/navigation";
import { getTarget, TOUCHES, STATUSES, LABEL } from "@/lib/gtm";
import { logTouch, updateTarget } from "@/lib/gtm-actions";
import { q } from "@/lib/db";
import { ago, phonePretty } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function Store({ params }) {
  const { id } = await params;
  const t = await getTarget(Number(id));
  if (!t) notFound();
  const dealerships = await q(`SELECT id, name FROM dealerships ORDER BY name`);
  const maps = `https://maps.google.com/?q=${encodeURIComponent(t.dealership + ", " + (t.address || "Calgary AB"))}`;
  const tel = t.phone ? "tel:" + t.phone.replace(/[^\d+]/g, "") : null;

  return (
    <div className="stack">
      <div>
        <Link href="/gtm" className="small muted">‹ Today</Link>
        <div className="row between" style={{ alignItems: "flex-start", marginTop: 6 }}>
          <div>
            <h1 style={{ fontSize: 22 }}>{t.dealership}</h1>
            <p className="ink2 small" style={{ margin: "2px 0 0" }}>{t.brands} · {t.grp} · route #{t.route_order}</p>
          </div>
          <span className={`pill ${t.eff}`}>{LABEL[t.eff]}</span>
        </div>
      </div>

      <div className="row wrap">
        {tel && <a className="btn accent" href={tel}>Call {phonePretty ? phonePretty(t.phone) : t.phone}</a>}
        <a className="btn" href={maps} target="_blank" rel="noreferrer">Directions</a>
        {t.dealership_id && <Link className="btn" href={`/dealers?q=${encodeURIComponent(t.dealership)}`}>Platform account</Link>}
        {!t.dealership_id && <Link className="btn" href={`/intake?dealership=${encodeURIComponent(t.dealership)}&brand=${encodeURIComponent((t.brands || "").split(",")[0].trim())}`}>Sign them up</Link>}
      </div>

      <div className="card">
        <div className="hd"><h3>Who to ask for</h3></div>
        <div className="bd">
          <dl className="kv">
            <dt>GM</dt><dd>{t.gm || <span className="muted">unknown</span>}</dd>
            <dt>GSM</dt><dd>{t.gsm || <span className="muted">unknown – ask at the desk</span>}</dd>
            <dt>Notes</dt><dd>{t.contact_notes || "—"}</dd>
            <dt>Address</dt><dd>{t.address}</dd>
            <dt>Owner</dt><dd>{t.owner || <span className="muted">unassigned</span>}</dd>
            {t.next_step && <><dt>Next step</dt><dd>{t.next_step}{t.next_at ? ` · ${String(t.next_at).slice(0, 10)}` : ""}</dd></>}
            {t.dealership_id && <><dt>Platform</dt><dd className="small">{t.bid_count} bids · {t.listed_count} listed · {t.sold_count} sold</dd></>}
          </dl>
        </div>
      </div>

      <div className="card">
        <div className="hd"><h3>Log a touch</h3><span className="xs muted">one tap</span></div>
        <div className="bd stack-sm">
          <form action={logTouch.bind(null, "note", "")} className="stack-sm">
            <input type="hidden" name="id" value={t.id} />
            <div className="touch-grid">
              {TOUCHES.map(([kind, outcome, label]) => (
                <button key={label} formAction={logTouch.bind(null, kind, outcome)}
                        className={outcome === "signed" ? "good" : outcome === "not_interested" ? "bad" : ""}>
                  {label}
                </button>
              ))}
            </div>
            <div className="grid g2">
              <div className="field"><label>Met with</label><input name="met_with" placeholder="Name, title" /></div>
              <div className="field"><label>Follow up on</label><input type="date" name="next_at" defaultValue={t.next_at ? String(t.next_at).slice(0, 10) : ""} /></div>
            </div>
            <div className="field"><label>Next step</label><input name="next_step" defaultValue={t.next_step || ""} placeholder="e.g. text him the X5 result Thursday" /></div>
            <div className="field"><label>Note</label><textarea name="note" rows={2} placeholder="What they said, what they wholesale, who else to talk to" /></div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="hd"><h3>History</h3><span className="xs muted">{t.touches} touches</span></div>
        <div className="bd">
          {t.log.length ? (
            <ul className="log">
              {t.log.map((l) => (
                <li key={l.id}>
                  <div><b>{l.kind}</b>{l.outcome ? ` → ${LABEL[l.outcome]}` : ""}{l.met_with ? ` · met ${l.met_with}` : ""}</div>
                  {l.note && <div className="ink2">{l.note}</div>}
                  <div className="m">{l.by_name || "—"} · {ago ? ago(l.created_at) : new Date(l.created_at).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          ) : <p className="muted small" style={{ margin: 0 }}>No touches yet.</p>}
        </div>
      </div>

      <details className="card">
        <summary style={{ padding: "14px 18px", cursor: "pointer", fontWeight: 650, fontSize: 14 }}>Edit store details</summary>
        <div className="bd">
          <form action={updateTarget} className="stack-sm">
            <input type="hidden" name="id" value={t.id} />
            <div className="grid g2">
              <div className="field"><label>GM</label><input name="gm" defaultValue={t.gm || ""} /></div>
              <div className="field"><label>GSM</label><input name="gsm" defaultValue={t.gsm || ""} /></div>
              <div className="field"><label>Phone</label><input name="phone" defaultValue={t.phone || ""} /></div>
              <div className="field"><label>Owner (rep)</label><input name="owner" defaultValue={t.owner || ""} /></div>
              <div className="field"><label>Priority</label><select name="priority" defaultValue={t.priority}><option>A</option><option>B</option><option>C</option></select></div>
              <div className="field"><label>Status (manual)</label>
                <select name="status" defaultValue={t.status}>{STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
              <div className="field" style={{ gridColumn: "1 / -1" }}><label>Linked platform account</label>
                <select name="dealership_id" defaultValue={t.dealership_id || ""}>
                  <option value="">— not on the platform yet —</option>
                  {dealerships.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select></div>
            </div>
            <div className="field"><label>Contact notes</label><textarea name="contact_notes" rows={2} defaultValue={t.contact_notes || ""} /></div>
            <button className="btn primary">Save</button>
          </form>
        </div>
      </details>
    </div>
  );
}
