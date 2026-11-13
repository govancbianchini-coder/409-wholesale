"use client";
import { useActionState, useEffect, useState } from "react";
import { placeBid } from "@/lib/bidding";

export function Gallery({ photos }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); if (e.key === "ArrowRight") setI((x) => (x + 1) % photos.length); if (e.key === "ArrowLeft") setI((x) => (x - 1 + photos.length) % photos.length); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [open, photos.length]);
  if (!photos.length) return <div className="gallery"><div className="main" /></div>;
  return (
    <div className="gallery">
      {/* Whole photo always visible (portrait phone shots are letterboxed, not cropped); tap for full screen. */}
      <img className="main" src={photos[i]} alt="" onClick={() => setOpen(true)} />
      <span className="count">{i + 1} / {photos.length}</span>
      {open && (
        <div className="lightbox" onClick={() => setOpen(false)}>
          <img src={photos[i]} alt="" onClick={(e) => { e.stopPropagation(); setI((i + 1) % photos.length); }} />
          <button type="button" className="x" onClick={() => setOpen(false)} aria-label="Close">×</button>
          {photos.length > 1 && <>
            <button type="button" className="nav l" onClick={(e) => { e.stopPropagation(); setI((i - 1 + photos.length) % photos.length); }} aria-label="Previous">‹</button>
            <button type="button" className="nav r" onClick={(e) => { e.stopPropagation(); setI((i + 1) % photos.length); }} aria-label="Next">›</button>
          </>}
        </div>
      )}
      {photos.length > 1 && (
        <div className="strip">
          {photos.map((p, n) => (
            <button key={n} className={n === i ? "on" : ""} onClick={() => setI(n)} type="button"><img src={p} alt="" loading="lazy" /></button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Countdown({ to }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return <span className="countdown">Closed</span>;
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return <span className="countdown">{d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m ${String(sec).padStart(2, "0")}s`}</span>;
}

export function BidBox({ token, current, open }) {
  const [state, action, pending] = useActionState(placeBid, null);
  const [amt, setAmt] = useState("");
  const mine = state?.ok ? state.amount : current;
  const fmt = (n) => "$" + Number(n).toLocaleString("en-CA");
  const onAmt = (e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 7); setAmt(d ? Number(d).toLocaleString("en-CA") : ""); };
  if (!open) return null;
  return (
    <form action={action} className="bidbox">
      <input type="hidden" name="token" value={token} />
      {state?.error && <div className="notice bad" style={{ marginBottom: 10 }}>{state.error}</div>}
      {state?.ok && <div className="notice good" style={{ marginBottom: 10 }}>{state.revised ? "Updated" : "Got it"}: your bid is <b>{fmt(state.amount)}</b>. You can change it until bidding closes.</div>}
      {!state?.ok && mine ? <div className="small ink2" style={{ marginBottom: 8 }}>Your current bid: <b>{fmt(mine)}</b>. Enter a new number to change it.</div> : null}
      <div className="row">
        <div className="amt grow"><span>$</span><input type="text" inputMode="numeric" name="amount" value={amt} onChange={onAmt} placeholder={mine ? Number(mine).toLocaleString("en-CA") : "Your number"} required aria-label="Bid amount" /></div>
        <button className="btn primary lg" disabled={pending}>{pending ? "…" : mine ? "Update" : "Bid"}</button>
      </div>
      <details style={{ marginTop: 8 }}><summary className="small muted" style={{ cursor: "pointer" }}>Add a note</summary><textarea name="note" placeholder="e.g. subject to PPI, can pick up Thursday" style={{ marginTop: 6, minHeight: 60 }} /></details>
      <label className="check xs" style={{ marginTop: 8 }}><input type="checkbox" name="agree" defaultChecked={Boolean(current)} required /> <span>My bid is binding if accepted, per the <a href="/terms" target="_blank">bid terms</a>.</span></label>
    </form>
  );
}
