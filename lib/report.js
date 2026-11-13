// Market report shape and validation.
//
// {
//   generated_at: ISO string,
//   sources: ["AutoTrader.ca", "CarGurus.ca"],
//   search_notes: "Searched 1,000 km (5 comps), widened to 2020–2022, then national.",
//   radius_km: 1000,
//   stats: {
//     local_count, local_avg_price, local_avg_km,
//     national_count, national_avg_price, national_avg_km,
//     avg_days_listed (optional), cbb_wholesale (optional), cbb_retail (optional)
//   },
//   comps: [{ year, make, model, trim, colour, km, price, days, seller, city, province, distance_km, url, source }],
//   summary: "Plain-language read of the market for this unit (dealer-safe, no 409 numbers).",
//   carfax: { url, summary, accidents, owners, province } (optional)
//   days_supply: 135 (optional, market days supply for the segment),
//   recon: [{ item: "Rear bumper refinish", est: 750 }, ...] (optional, estimated recon to retail standard),
//   notes: ["Two sets of new tires", "Never tuned"] (optional, what we noted on the car),
//   my_take: "Why this unit fits a buyer's lot: 2-4 sentences." (optional)
// }

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
};
const str = (v, max = 200) => (v === null || v === undefined ? null : String(v).trim().slice(0, max) || null);

export function normalizeReport(input) {
  if (!input || typeof input !== "object") throw new Error("Report must be an object");
  const comps = Array.isArray(input.comps) ? input.comps : [];
  if (!comps.length) throw new Error("Report needs at least one comp");
  const cleanComps = comps.slice(0, 60).map((c) => ({
    year: num(c.year),
    make: str(c.make, 40),
    model: str(c.model, 60),
    trim: str(c.trim, 80),
    colour: str(c.colour || c.color, 30),
    km: num(c.km),
    price: num(c.price),
    days: num(c.days ?? c.days_listed),
    seller: str(c.seller, 80),
    city: str(c.city, 60),
    province: str(c.province, 10),
    distance_km: num(c.distance_km ?? c.distance),
    url: str(c.url, 500),
    source: str(c.source, 30),
  })).filter((c) => c.price);
  // Local dealers bidding on local cars: nearest first, then by km.
  cleanComps.sort((a, b) => ((a.distance_km ?? 9e9) - (b.distance_km ?? 9e9)) || ((a.km ?? 9e9) - (b.km ?? 9e9)));

  const local = cleanComps.filter((c) => c.distance_km != null && c.distance_km <= (num(input.radius_km) || 1000));
  const avg = (arr, k) => { const v = arr.map((x) => x[k]).filter((x) => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const s = input.stats || {};
  const stats = {
    local_count: num(s.local_count) ?? local.length,
    local_avg_price: num(s.local_avg_price) ?? avg(local, "price"),
    local_avg_km: num(s.local_avg_km) ?? avg(local, "km"),
    national_count: num(s.national_count) ?? cleanComps.length,
    national_avg_price: num(s.national_avg_price) ?? avg(cleanComps, "price"),
    national_avg_km: num(s.national_avg_km) ?? avg(cleanComps, "km"),
    avg_days_listed: num(s.avg_days_listed) ?? avg(cleanComps, "days"),
    cbb_wholesale: num(s.cbb_wholesale),
    cbb_retail: num(s.cbb_retail),
  };
  const carfax = input.carfax && typeof input.carfax === "object" ? {
    url: str(input.carfax.url, 500),
    summary: str(input.carfax.summary, 400),
    accidents: num(input.carfax.accidents),
    owners: num(input.carfax.owners),
    province: str(input.carfax.province, 40),
  } : null;
  const recon = Array.isArray(input.recon) ? input.recon.slice(0, 12).map((r) => (typeof r === "string" ? { item: str(r, 80), est: null } : { item: str(r.item || r.name, 80), est: num(r.est ?? r.cost ?? r.amount) })).filter((r) => r.item) : [];
  const notes = Array.isArray(input.notes) ? input.notes.map((n) => str(n, 160)).filter(Boolean).slice(0, 12) : [];
  return {
    generated_at: new Date().toISOString(),
    days_supply: num(input.days_supply ?? input.market_days_supply),
    recon,
    recon_total: recon.reduce((a, r) => a + (r.est || 0), 0) || null,
    notes,
    my_take: str(input.my_take ?? input.take, 1200),
    sources: Array.isArray(input.sources) ? input.sources.map((x) => str(x, 40)).filter(Boolean).slice(0, 6) : [],
    search_notes: str(input.search_notes, 400),
    radius_km: num(input.radius_km) || 1000,
    stats,
    comps: cleanComps,
    summary: str(input.summary, 1500),
    carfax,
  };
}
