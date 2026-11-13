"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { startCallout } from "@/lib/dealer";

export default function CalloutStart() {
  const [st, action, pending] = useActionState(startCallout, null);
  const [f, setF] = useState({});
  const [scan, setScan] = useState(false);
  const [msg, setMsg] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const val = (k) => f[k] ?? "";

  async function decode(vin) {
    const v = (vin || f.vin || "").toUpperCase().trim();
    if (v.length !== 17) return setMsg("VIN needs 17 characters.");
    setMsg("Looking up…");
    const r = await fetch(`/api/vin?vin=${encodeURIComponent(v)}`);
    const d = await r.json();
    if (!r.ok) return setMsg(d.error);
    setF((x) => { const n = { ...x, vin: v }; for (const k of ["year", "make", "model", "trim", "engine", "drivetrain", "transmission"]) if (d[k]) n[k] = d[k]; return n; });
    setMsg(d.make ? `${d.year} ${d.make} ${d.model} — check the trim, then km.` : "Couldn't decode that VIN. Fill it in by hand.");
  }

  // Barcode scan with the phone camera. Uses the browser's BarcodeDetector where it exists (Chrome/Android),
  // otherwise a WASM decoder (iPhone Safari has no BarcodeDetector). VIN plates are Code 39/128, sometimes QR.
  useEffect(() => {
    if (!scan) return;
    let stop = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setMsg("Hold the barcode inside the frame…");

        const pick = (values) => {
          for (const raw of values) {
            const s = String(raw || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
            const m = s.match(/[A-HJ-NPR-Z0-9]{17}/);
            if (m) return m[0];
          }
          return null;
        };
        const done = (vin) => { setF((x) => ({ ...x, vin })); setScan(false); decode(vin); };

        let detect;
        if ("BarcodeDetector" in window) {
          const det = new window.BarcodeDetector({ formats: ["code_39", "code_128", "qr_code", "data_matrix"] });
          detect = async () => pick((await det.detect(videoRef.current)).map((c) => c.rawValue));
        } else {
          const { readBarcodes, prepareZXingModule } = await import("zxing-wasm/reader");
          prepareZXingModule({ overrides: { locateFile: (path, prefix) => (path.endsWith(".wasm") ? "/zxing_reader.wasm" : prefix + path) } });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          detect = async () => {
            const v = videoRef.current;
            if (!v || !v.videoWidth) return null;
            canvas.width = v.videoWidth; canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const res = await readBarcodes(img, { formats: ["Code39", "Code128", "QRCode", "DataMatrix"], tryHarder: true, tryRotate: true, maxNumberOfSymbols: 4 });
            return pick(res.map((r) => r.text));
          };
        }
        const tick = async () => {
          if (stop) return;
          try { const vin = await detect(); if (vin) { done(vin); return; } } catch {}
          setTimeout(tick, 180);
        };
        tick();
      } catch (e) { setMsg("Camera not available — type the VIN instead."); setScan(false); }
    })();
    return () => { stop = true; streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, [scan]);

  const I = (k, label, props = {}) => <label className={`f ${props.full ? "full" : ""}`}><span>{label}</span><input type="text" name={k} value={val(k)} onChange={set(k)} autoComplete="off" {...props} full={undefined} /></label>;

  return (
    <form action={action} className="stack">
      <div><div className="mr-eyebrow">Step 1 of 3</div><h1>Call out a unit</h1><p className="ink2" style={{ margin: "4px 0 0" }}>Scan the VIN on the door jamb or windshield, or type it.</p></div>
      {st?.error && <div className="notice bad">{st.error}</div>}
      {scan ? (
        <div className="scanbox"><video ref={videoRef} muted playsInline /><div className="frame" /><button type="button" className="btn sm" style={{ position: "absolute", top: 8, right: 8 }} onClick={() => setScan(false)}>Cancel</button></div>
      ) : (
        <button type="button" className="btn lg block" onClick={() => { setMsg(null); setScan(true); }}>📷 Scan VIN barcode</button>
      )}
      <div className="row" style={{ alignItems: "flex-end" }}>
        <label className="f grow"><span>VIN</span><input type="text" name="vin" value={val("vin")} onChange={(e) => setF((x) => ({ ...x, vin: e.target.value.toUpperCase() }))} maxLength={17} autoCapitalize="characters" autoComplete="off" style={{ fontFamily: "ui-monospace, Menlo, monospace", letterSpacing: ".04em" }} required /></label>
        <button type="button" className="btn" onClick={() => decode()}>Decode</button>
      </div>
      {msg && <div className="small ink2">{msg}</div>}
      <div className="fgrid">
        {I("year", "Year", { inputMode: "numeric", required: true })}
        {I("make", "Make", { required: true })}
        {I("model", "Model", { required: true })}
        {I("trim", "Trim")}
        {I("km", "Kilometres", { inputMode: "numeric", required: true })}
        {I("exterior", "Exterior colour")}
        {I("interior", "Interior")}
        {I("drivetrain", "Drivetrain")}
        <input type="hidden" name="engine" value={val("engine")} />
        <input type="hidden" name="transmission" value={val("transmission")} />
      </div>
      <div className="stickybar"><div className="inner"><button className="btn primary lg block" disabled={pending}>{pending ? "Saving…" : "Next: photos →"}</button></div></div>
    </form>
  );
}
