import { notFound } from "next/navigation";
import { q, one } from "@/lib/db";
import { title, km, when, currentUser, money } from "@/lib/util";
import { Gallery, Countdown, BidBox } from "@/components/BidClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { token } = await params;
  const v = await one(`SELECT v.* FROM invitations i JOIN vehicles v ON v.id = i.vehicle_id WHERE i.token = $1`, [token]);
  return { title: v ? `${title(v)} · 409 Wholesale` : "409 Wholesale" };
}

export default async function BidPage({ params, searchParams }) {
  const { token } = await params;
  const sp = await searchParams;
  const inv = await one(`SELECT * FROM invitations WHERE token = $1`, [token]);
  if (!inv) notFound();
  const v = await one(`SELECT * FROM vehicles WHERE id = $1`, [inv.vehicle_id]);
  const c = await one(`SELECT first_name, dealership FROM contacts WHERE id = $1`, [inv.contact_id]);
  const photos = (await q(`SELECT url FROM photos WHERE vehicle_id = $1 ORDER BY sort, id`, [v.id])).map((p) => p.url);
  const mine = await one(`SELECT amount FROM bids WHERE vehicle_id = $1 AND contact_id = $2 AND NOT superseded`, [v.id, inv.contact_id]);

  // Count the view (not when 409 staff preview it)
  const user = await currentUser();
  if (!user && !sp?.preview) {
    await q(`UPDATE invitations SET view_count = view_count + 1, first_viewed_at = coalesce(first_viewed_at, now()) WHERE id = $1`, [inv.id]);
  }

  const open = v.status === "live" && v.closes_at && new Date(v.closes_at) > new Date();
  const won = v.status === "awarded" && v.winning_bid_id && (await one(`SELECT 1 FROM bids WHERE id = $1 AND contact_id = $2`, [v.winning_bid_id, inv.contact_id]));

  const specs = [
    ["Kilometres", km(v.km)],
    ["Exterior", v.exterior],
    ["Interior", v.interior],
    ["Engine", v.engine],
    ["Drivetrain", v.drivetrain],
    ["Transmission", v.transmission],
    ["VIN", v.vin],
    ["Location", v.location],
  ].filter(([, x]) => x);

  return (
    <>
      <div className="pub-top"><div className="inner"><span className="brand">409 WHOLESALE</span><span className="xs" style={{ color: "#9b968d" }}>{c.dealership}</span></div></div>
      {user && <div className="notice warn" style={{ borderRadius: 0, textAlign: "center" }}>Preview as {c.first_name} at {c.dealership}. Your views aren't counted.</div>}
      <div className="pub">
        <Gallery photos={photos} />
        <div className="pub-body">
          <div className="row between" style={{ alignItems: "flex-start" }}>
            <div>
              <h1 style={{ fontSize: 22 }}>{title(v)}</h1>
              <div className="ink2 small" style={{ marginTop: 2 }}>{km(v.km)} · {v.code}</div>
            </div>
            <div className="right">
              <div className="xs muted" style={{ textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600 }}>{open ? "Closes in" : "Bidding"}</div>
              <div style={{ fontSize: 18 }}>{open ? <Countdown to={v.closes_at} /> : <b>Closed</b>}</div>
              <div className="xs muted">{when(v.closes_at)}</div>
            </div>
          </div>

          {won && <div className="notice good" style={{ marginTop: 14 }}>Your bid of <b>{money(mine?.amount)}</b> won this unit. We'll be in touch about paperwork and pickup.</div>}
          {!open && !won && v.status === "awarded" && <div className="notice" style={{ marginTop: 14 }}>This unit has sold. Thanks for putting a number on it. More coming soon.</div>}
          {!open && !won && v.status !== "awarded" && <div className="notice warn" style={{ marginTop: 14 }}>Bidding has closed on this unit.{mine ? ` Your bid: ${money(mine.amount)}.` : ""}</div>}

          {v.announcements && (
            <div className="card"><div className="bd"><h3 style={{ marginBottom: 6 }}>Announcements</h3><div className="small" style={{ whiteSpace: "pre-wrap" }}>{v.announcements}</div></div></div>
          )}

          <div className="card"><div className="bd">
            <div className="specs">{specs.map(([k, x]) => <div key={k}><b>{k}</b>{x}</div>)}</div>
          </div></div>

          {v.condition_notes && <div className="card"><div className="bd"><h3 style={{ marginBottom: 6 }}>Condition</h3><div className="small ink2" style={{ whiteSpace: "pre-wrap" }}>{v.condition_notes}</div></div></div>}

          {(v.carfax_summary || v.carfax_url) && (
            <div className="card"><div className="bd row between">
              <div><h3>Vehicle history</h3>{v.carfax_summary && <div className="small ink2" style={{ marginTop: 4 }}>{v.carfax_summary}</div>}</div>
              {v.carfax_url && <a className="btn sm" href={v.carfax_url} target="_blank" rel="noopener">View report</a>}
            </div></div>
          )}

          <p className="xs muted" style={{ marginTop: 18, lineHeight: 1.6 }}>
            Bids are blind. No one sees anyone else's number. You can change your bid until it closes. Questions: 403.808.1801.
            <br />409 Wholesale, a division of 409 Motor Company · 101 Highland Park Common NE, Airdrie AB · <a href="/terms">Bid terms</a>
          </p>
        </div>
      </div>
      <BidBox token={token} current={mine?.amount} open={open} />
    </>
  );
}
