import { notFound } from "next/navigation";
import "../sheet.css";
import { q, one } from "@/lib/db";
import { title, km, when, currentUser, money } from "@/lib/util";
import { Gallery, Countdown, BidBox } from "@/components/BidClient";
import MarketReport from "@/components/MarketReport";
import Settlement from "@/components/Settlement";
import { sweepClosed } from "@/lib/close";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { token } = await params;
  const v = await one(`SELECT v.* FROM invitations i JOIN vehicles v ON v.id = i.vehicle_id WHERE i.token = $1`, [token]);
  return { title: v ? `${title(v)} · Overbid` : "Overbid" };
}

export default async function BidPage({ params, searchParams }) {
  const { token } = await params;
  const sp = await searchParams;
  const inv = await one(`SELECT * FROM invitations WHERE token = $1`, [token]);
  if (!inv) notFound();
  await sweepClosed();
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
    ["Drivetrain", v.drivetrain],
    ["Engine", v.engine],
    ["Transmission", v.transmission],
    ["VIN", v.vin],
    ["Location", v.location],
  ].filter(([, x]) => x);

  const rep = v.report?.comps?.length ? v.report : null;
  const st = rep?.stats || {};
  const radius = rep?.radius_km || 1000;
  const vinLine = [v.vin ? `VIN ${v.vin}` : null, km(v.km), v.exterior].filter(Boolean).join(" · ");

  return (
    <div className="sheet">
      {user && <div className="preview">Preview as {c.first_name} at {c.dealership}. Your views aren't counted.</div>}

      <header className="band">
        <div>
          <img src="/lockup-dark.png" alt="Overbid" />
          <div className="eyebrow">Dealer bid sheet · {v.code}</div>
          <h1 className="display">{title(v)}</h1>
          <div className="vin">{vinLine}</div>
        </div>
        <div className="to">
          Prepared for<b>{c.dealership}</b>
          {open ? <a href="#bid">Place your bid ↓</a> : <span>Bidding closed</span>}
        </div>
      </header>

      <Gallery photos={photos} />

      <div className="tiles">
        <div className="tile hi">
          <p className="lbl">{open ? "Bidding closes in" : "Bidding"}</p>
          <div className="v">{open ? <Countdown to={v.closes_at} /> : "Closed"}</div>
          <div className="s">{when(v.closes_at)} · blind bids, change yours until it closes</div>
        </div>
        <div className="tile">
          <p className="lbl">Comparable units</p>
          <div className="v">{rep ? (st.national_count ?? rep.comps.length) : "—"}</div>
          <div className="s">{rep ? `${st.local_count ?? 0} within ${radius.toLocaleString("en-CA")} km${st.local_avg_price ? ` · avg ask ${money(st.local_avg_price)}` : ""}` : "Market report pending"}</div>
        </div>
        <div className="tile">
          {rep?.days_supply != null ? (
            <><p className="lbl">Market days supply</p><div className="v">{rep.days_supply} days</div><div className="s">Time to sell at today's pace</div></>
          ) : rep?.recon_total ? (
            <><p className="lbl">Est. recon to retail</p><div className="v">{money(rep.recon_total)}</div><div className="s">Itemized below · confirm on inspection</div></>
          ) : (
            <><p className="lbl">Kilometres</p><div className="v">{km(v.km)}</div><div className="s">{v.exterior || ""}{v.interior ? ` · ${v.interior}` : ""}</div></>
          )}
        </div>
      </div>

      {won && <div className="note good">Your bid of <b>{money(mine?.amount)}</b> won this unit. Overbid sends the bill of sale; the settlement sheet below tracks payment and pickup.</div>}
      {won && <section style={{ margin: "16px 0" }}><Settlement v={v} role="buyer" /></section>}
      {!open && !won && v.status === "awarded" && <div className="note">This unit has sold. Thanks for putting a number on it. More coming soon.</div>}
      {!open && !won && v.status !== "awarded" && <div className="note warn">Bidding has closed on this unit.{mine ? ` Your bid: ${money(mine.amount)}.` : ""}</div>}

      {(v.announcements || v.condition_notes) && (
        <section className="sec">
          <p className="lbl">Seller's announcements</p>
          {v.announcements && <div className="ptext">{v.announcements}</div>}
          {v.condition_notes && <div className="ptext" style={{ marginTop: 8 }}>{v.condition_notes}</div>}
        </section>
      )}

      <section className="sec">
        <p className="lbl">Vehicle</p>
        <div className="specs">{specs.map(([k, x]) => <div key={k}><b>{k}</b>{x}</div>)}</div>
      </section>

      {rep ? <MarketReport report={rep} unit={v} /> : null}

      {!rep && (v.carfax_summary || v.carfax_url) && (
        <section className="sec">
          <p className="lbl">Vehicle history</p>
          <div className="ptext">{v.carfax_summary}</div>
          {v.carfax_url && <p><a href={v.carfax_url} target="_blank" rel="noopener">View report</a></p>}
        </section>
      )}

      <div className="bidwrap">
        <BidBox token={token} current={mine?.amount} open={open} sheet />
      </div>
      <p className="blind">Bids are blind: no one sees anyone else's number. You can change your bid until it closes. The seller sees the top bids net of Overbid's spread and takes the number or declines. Questions: 403.808.1801.</p>

      <footer className="foot">
        <span><b>Prepared by Overbid</b> · a 409 Motor Company platform</span>
        <span>101 Highland Park Common NE, Unit 1006, Airdrie, AB · overbid.ca · <a href="/terms">Bid terms</a></span>
      </footer>
    </div>
  );
}
