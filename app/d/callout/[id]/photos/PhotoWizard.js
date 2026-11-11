"use client";
import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSlotPhoto, submitCallout } from "@/lib/dealer";

async function resize(file, max = 1800) {
  if (!file.type.startsWith("image/")) return file;
  const img = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

export default function PhotoWizard({ vehicleId, titleText, shots, have: initial, notes }) {
  const router = useRouter();
  const [have, setHave] = useState(initial);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [active, setActive] = useState(shots.find(([s]) => !initial[s])?.[0] || null);
  const inputRef = useRef(null);
  const [st, action, pending] = useActionState(submitCallout, null);
  const done = shots.filter(([s]) => have[s]).length;
  const next = shots.find(([s]) => !have[s]);

  function openCamera(slot) { setActive(slot); setErr(null); setTimeout(() => inputRef.current?.click(), 0); }

  async function onFile(e) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file || !active) return;
    const slot = active;
    setBusy(slot);
    try {
      const fd = new FormData(); fd.append("file", await resize(file));
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Upload failed");
      await saveSlotPhoto(vehicleId, slot, d.url);
      setHave((h) => ({ ...h, [slot]: d.url }));
      const nxt = shots.find(([s]) => s !== slot && !{ ...have, [slot]: d.url }[s]);
      setActive(nxt?.[0] || null);
    } catch (x) { setErr(x.message); }
    setBusy(null);
  }

  const activeShot = shots.find(([s]) => s === active);

  return (
    <div className="stack">
      <div><div className="mr-eyebrow">Step 2 of 3 · {titleText}</div><h1>Photos</h1><p className="ink2" style={{ margin: "4px 0 0" }}>{shots.length} required shots. Tap a box, take the photo, it saves on its own.</p></div>
      <div><div className="progress"><i style={{ width: `${(done / shots.length) * 100}%` }} /></div><div className="xs muted" style={{ marginTop: 4 }}>{done} of {shots.length}</div></div>
      {err && <div className="notice bad">{err}</div>}
      {activeShot && (
        <div className="notice" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div><b>Next: {activeShot[1]}</b><div className="small" style={{ fontWeight: 400 }}>{activeShot[2]}</div></div>
          <button type="button" className="btn primary" onClick={() => openCamera(activeShot[0])} disabled={!!busy}>📷 Take it</button>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <div className="shots">
        {shots.map(([slot, label], i) => (
          <div key={slot} className={`shot ${have[slot] ? "done" : ""} ${busy === slot ? "busy" : ""}`} onClick={() => openCamera(slot)}>
            {have[slot] && <img src={have[slot]} alt="" />}
            <span className="n">{i + 1}</span>
            <span className="lbl">{busy === slot ? "Uploading…" : label}</span>
          </div>
        ))}
      </div>

      <form action={action} className="stack" style={{ marginTop: 8 }}>
        <input type="hidden" name="id" value={vehicleId} />
        <div><div className="mr-eyebrow">Step 3 of 3</div><h2>Dealer notes</h2></div>
        {st?.error && <div className="notice bad">{st.error}</div>}
        <textarea name="notes" defaultValue={notes} placeholder="What you know: service history, accidents or claims, warning lights, tires/brakes, keys, options worth noting, anything a buyer should hear from you first." style={{ minHeight: 120 }} />
        <div className="stickybar"><div className="inner row" style={{ gap: 10 }}>
          <a href="/d" className="btn">Save for later</a>
          <button className="btn primary lg grow" disabled={pending || done < shots.length}>{done < shots.length ? `${shots.length - done} photo${shots.length - done > 1 ? "s" : ""} to go` : pending ? "Submitting…" : "Submit to Overbid"}</button>
        </div></div>
      </form>
      <div style={{ height: 40 }} />
    </div>
  );
}
