"use client";
import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPhotos, deletePhoto, makeCover, setCarfax } from "@/lib/units";

const fmt = (n) => (n == null ? "—" : "$" + Number(n).toLocaleString("en-CA"));

async function resize(file, max = 1600) {
  if (!file.type.startsWith("image/")) return file;
  const img = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

async function upload(file) {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Upload failed");
  return d.url;
}

export function PhotoManager({ vehicleId, photos, carfaxUrl }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [, start] = useTransition();

  async function onFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setErr(null);
    const urls = [];
    for (let i = 0; i < files.length; i++) {
      setBusy(`Uploading ${i + 1} of ${files.length}…`);
      try { urls.push(await upload(await resize(files[i]))); } catch (x) { setErr(x.message); }
    }
    if (urls.length) await addPhotos(vehicleId, urls);
    setBusy(null);
    router.refresh();
  }

  async function onCarfax(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy("Uploading report…");
    try { await setCarfax(vehicleId, await upload(f)); } catch (x) { setErr(x.message); }
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="stack">
      {err && <div className="notice bad">{err}</div>}
      <div className="row wrap">
        <label className="btn primary">
          {busy || "Add photos"}
          <input type="file" accept="image/*" multiple hidden onChange={onFiles} disabled={!!busy} />
        </label>
        <label className="btn">
          {carfaxUrl ? "Replace history report (PDF)" : "Upload history report (PDF)"}
          <input type="file" accept="application/pdf,image/*" hidden onChange={onCarfax} disabled={!!busy} />
        </label>
        {carfaxUrl && <a href={carfaxUrl} target="_blank" className="small">View report</a>}
      </div>
      {photos.length ? (
        <div className="photo-grid">
          {photos.map((p, i) => (
            <div className="ph" key={p.id}>
              <img src={p.url} alt="" />
              <button type="button" onClick={() => start(async () => { await deletePhoto(vehicleId, p.id); router.refresh(); })}>Remove</button>
              {i === 0 ? (
                <span className="tag" style={{ position: "absolute", left: 6, bottom: 6 }}>Cover</span>
              ) : (
                <button type="button" style={{ top: "auto", bottom: 6, right: "auto", left: 6 }} onClick={() => start(async () => { await makeCover(vehicleId, p.id); router.refresh(); })}>Make cover</button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="small muted">No photos yet. The first photo becomes the cover in the email.</div>
      )}
    </div>
  );
}

export function SendPanel({ action, vehicleId, candidates, closed }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [filter, setFilter] = useState("");
  const [sel, setSel] = useState(() => new Set(candidates.filter((c) => c.preselect).map((c) => c.id)));
  const shown = useMemo(() => {
    const t = filter.toLowerCase();
    return candidates.filter((c) => !t || `${c.first_name} ${c.last_name || ""} ${c.dealership} ${c.brand || ""}`.toLowerCase().includes(t));
  }, [candidates, filter]);
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const setMany = (ids, on) => setSel((s) => { const n = new Set(s); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="vehicle_id" value={vehicleId} />
      {state?.error && <div className="notice bad">{state.error}</div>}
      {state?.ok && (
        <div className={`notice ${state.failed ? "warn" : "good"}`}>
          Sent {state.emails} email{state.emails === 1 ? "" : "s"} and {state.texts} text{state.texts === 1 ? "" : "s"}.
          {state.failed ? ` ${state.failed} failed — see the dealer's message log.` : ""}
          {state.skipped ? ` ${state.skipped} skipped (no consent for that channel).` : ""}
          {state.simulated ? " Test mode: email/text keys aren't set, so nothing actually went out. Messages were logged." : ""}
        </div>
      )}
      {closed && <div className="notice warn">Bidding has closed. Extend the close time before sending to more dealers.</div>}
      <div className="row wrap">
        <input type="search" placeholder="Filter dealers" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 260 }} />
        <button type="button" className="btn sm" onClick={() => setMany(shown.filter((c) => c.reachable).map((c) => c.id), true)}>Select shown</button>
        <button type="button" className="btn sm" onClick={() => setMany(shown.map((c) => c.id), false)}>Clear</button>
        <button type="button" className="btn sm" onClick={() => setSel(new Set(candidates.filter((c) => c.preselect).map((c) => c.id)))}>Best matches</button>
        <span className="small muted" style={{ marginLeft: "auto" }}>{sel.size} selected</span>
      </div>
      <div className="tbl-wrap" style={{ maxHeight: 420, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 8 }}>
        <table className="data">
          <thead><tr><th style={{ width: 36 }}></th><th>Dealer</th><th>Why</th><th className="num">Bids / wins</th><th>Status</th></tr></thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id} style={{ opacity: c.reachable ? 1 : 0.5 }}>
                <td>{sel.has(c.id) && <input type="hidden" name="contact" value={c.id} />}<input type="checkbox" checked={sel.has(c.id)} disabled={!c.reachable} onChange={() => toggle(c.id)} style={{ width: 18, height: 18, accentColor: "#121314" }} /></td>
                <td><b>{c.dealership}</b><div className="xs muted">{c.first_name} {c.last_name}{c.brand ? ` · ${c.brand}` : ""}</div></td>
                <td className="xs">{c.reasons.map((r) => <span key={r} className={`tag ${r.startsWith("✕") ? "bad" : r.startsWith("★") ? "accent" : ""}`}>{r}</span>)}</td>
                <td className="num small">{c.bids} / {c.wins}</td>
                <td className="xs">{c.invited ? <span className="tag good">Sent {c.viewed ? "· viewed" : ""}</span> : !c.reachable ? <span className="tag">No consent</span> : ""}</td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={5} className="empty">No dealers yet. Add some first.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="row wrap">
        <label className="check"><input type="checkbox" name="via_email" defaultChecked /> Email</label>
        <label className="check"><input type="checkbox" name="via_sms" defaultChecked /> Text</label>
        <button className="btn accent" disabled={pending || !sel.size || closed} style={{ marginLeft: "auto" }}>{pending ? "Sending…" : `Send to ${sel.size} dealer${sel.size === 1 ? "" : "s"}`}</button>
      </div>
      <div className="xs muted">Dealers who already got this unit will get a reminder with the same link. Each dealer only gets the channels they agreed to.</div>
    </form>
  );
}

export function AwardPanel({ action, vehicleId, bids, margin, sellerAsk }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [bidId, setBidId] = useState(bids[0]?.id || "");
  const chosen = bids.find((b) => String(b.id) === String(bidId));
  const [buy, setBuy] = useState(chosen ? String(chosen.amount - margin) : "");
  const spread = chosen && buy ? chosen.amount - Number(String(buy).replace(/\D/g, "")) : null;
  if (!bids.length) return <div className="small muted">No bids to award yet.</div>;
  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="id" value={vehicleId} />
      {state?.error && <div className="notice bad">{state.error}</div>}
      <label className="f"><span>Winning bid</span>
        <select name="bid_id" value={bidId} onChange={(e) => { setBidId(e.target.value); const b = bids.find((x) => String(x.id) === e.target.value); if (b) setBuy(String(b.amount - margin)); }}>
          {bids.map((b) => <option key={b.id} value={b.id}>{fmt(b.amount)} · {b.dealership} ({b.first_name})</option>)}
        </select>
      </label>
      <label className="f"><span>409 pays the seller <em>(top bid − {fmt(margin)} margin)</em></span><input type="text" inputMode="numeric" name="buy_price" value={buy} onChange={(e) => setBuy(e.target.value)} /></label>
      <div className="small">
        Spread to 409: <b className="num">{spread == null ? "—" : fmt(spread)}</b>
        {sellerAsk ? <span className="muted"> · seller wanted {fmt(sellerAsk)}{chosen && Number(buy) < sellerAsk ? ` (${fmt(sellerAsk - Number(buy))} short)` : ""}</span> : null}
      </div>
      <label className="check"><input type="checkbox" name="notify" defaultChecked /> Let the winner know by email/text</label>
      <button className="btn primary" disabled={pending}>{pending ? "Saving…" : "Award & mark sold"}</button>
    </form>
  );
}

export function ManualBid({ action, vehicleId, contacts }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="stack-sm" key={state?.ok ? Math.random() : "f"}>
      <input type="hidden" name="id" value={vehicleId} />
      {state?.error && <div className="notice bad">{state.error}</div>}
      {state?.ok && <div className="notice good">Bid entered.</div>}
      <select name="contact_id" defaultValue="">
        <option value="" disabled>Dealer who called it in…</option>
        {contacts.map((c) => <option key={c.id} value={c.id}>{c.dealership} · {c.first_name} {c.last_name || ""}</option>)}
      </select>
      <div className="row"><input type="text" inputMode="numeric" name="amount" placeholder="$ amount" /><button className="btn" disabled={pending}>Add bid</button></div>
    </form>
  );
}
