import { currentUser } from "@/lib/util";

// Free VIN decode from NHTSA vPIC (no key needed).
export async function GET(req) {
  const user = await currentUser();
  if (user?.role !== "admin") return Response.json({ error: "Not allowed" }, { status: 401 });
  const vin = (new URL(req.url).searchParams.get("vin") || "").trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return Response.json({ error: "VIN should be 17 characters" }, { status: 400 });
  try {
    const r = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`, { cache: "no-store" });
    const d = (await r.json())?.Results?.[0] || {};
    const cyl = d.EngineCylinders ? `${d.EngineCylinders}-cyl` : "";
    const disp = d.DisplacementL ? `${Number(d.DisplacementL).toFixed(1)}L` : "";
    const turbo = d.Turbo === "Yes" ? "turbo" : "";
    const ev = d.ElectrificationLevel && /BEV/i.test(d.ElectrificationLevel) ? "Electric" : "";
    const tc = (s) => (s ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : "");
    return Response.json({
      year: d.ModelYear || "",
      make: tc(d.Make),
      model: d.Model || "",
      trim: [d.Trim, d.Series].filter(Boolean).join(" ").trim(),
      engine: ev || [disp, cyl, turbo].filter(Boolean).join(" "),
      drivetrain: d.DriveType ? d.DriveType.replace(/\/.*$/, "").replace("4x4", "4WD") : "",
      transmission: d.TransmissionStyle || "",
    });
  } catch {
    return Response.json({ error: "VIN lookup is unavailable right now. Fill it in by hand." }, { status: 502 });
  }
}
