import "./welcome.css";
import Reveal from "./Reveal";

export const metadata = {
  title: "Overbid – Dealer-to-dealer wholesale for Calgary",
  description: "List the trade you'd wholesale anyway. Eighty Calgary franchise stores bid in 2 hours. No auction fees, no transport, no float.",
};

const Mark = ({ className }) => (
  <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
    <path d="M31 22 A40 40 0 1 0 69 22" stroke="#F3EFE6" strokeWidth="9" fill="none" />
    <path d="M50 14 L71 35 L63 43 L50 30 L37 43 L29 35 Z" fill="#FF5A1F" />
    <path d="M50 44 L71 65 L63 73 L50 60 L37 73 L29 65 Z" fill="#FF5A1F" />
  </svg>
);
const Chev = ({ className }) => (
  <svg className={className} viewBox="0 0 44 44" aria-hidden="true">
    <path d="M22 2 L43 23 L35 31 L22 18 L9 31 L1 23 Z" fill="#FF5A1F" />
    <path d="M22 24 L43 45 L35 53 L22 40 L9 53 L1 45 Z" fill="#FF5A1F" transform="translate(0 -12)" opacity=".55" />
  </svg>
);

export default function Welcome() {
  return (
    <div className="lp">
      <Reveal />
      <header className="lp-head">
        <div className="wrap">
          <a className="logo" href="/" aria-label="Overbid"><img className="on-dark" src="/lockup-dark.png" alt="Overbid" /><img className="on-light" src="/lockup-light.png" alt="" /></a>
          <nav>
            <a href="#how">How it works</a>
            <a href="#dealers">For dealers</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="cta">
            <a className="btn-lp ghost" href="/login">Overbid team</a>
            <a className="btn-lp primary" href="/d/login">Dealer sign in</a>
          </div>
        </div>
      </header>

      {/* ---------- HERO ---------- */}
      <section className="hero">
        <div className="stage">
          <div className="grid-lines" />
          <div className="glow" />
          <div className="giant" data-t="OVERBID">OVERBID</div>
          <Mark className="mark" />
        </div>
        <div className="copy">
          <div className="wrap">
            <h1 className="rv in">Your trades. Eighty Calgary buyers. <span className="o">A better number in 2 hours.</span></h1>
            <div className="sub">
              <p className="rv in" style={{ "--d": ".15s" }}>
                Overbid is a dealer-to-dealer wholesale desk for Calgary and Airdrie. List the trade that doesn't fit your lot, or the one you can't get the right value on to make the customer's deal work. The local franchise network bids on it anonymously, and you take the top number or walk away.
              </p>
              <div className="acts rv in" style={{ "--d": ".3s" }}>
                <a className="btn-lp primary lg" href="/d/login">Dealer sign in</a>
                <a className="btn-lp ghost lg" href="#how">See how it works</a>
              </div>
            </div>
          </div>
        </div>
        <div className="wrap">
          <div className="ticker">
            <div><b>Bids</b>Free to join, free to bid</div>
            <div><b>Window</b>Top bids back in 2 hours</div>
            <div><b>Network</b>Calgary & Airdrie franchise stores</div>
            <div><b>Fees</b>No auction, no transport, no float</div>
          </div>
        </div>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section className="sec" id="how">
        <div className="wrap">
          <div className="head">
            <div>
              <div className="kicker rv">How it works</div>
              <h2 className="rv">Phone, VIN, sixteen photos. The network does the rest.</h2>
            </div>
            <p className="lead rv" style={{ "--d": ".1s" }}>No software to install and no workflow change. Your lot attendant can list a unit in two minutes; Overbid builds the market report and reviews it within the hour.</p>
          </div>
          <div className="steps">
            {[
              ["01", "List it from your phone", "VIN, mileage and 16 photos. Two minutes on the lot. Overbid builds the market report (retail comps, CARFAX when available) and reviews the unit within the hour."],
              ["02", "The network bids", "Franchise stores across Calgary see the unit and bid within 2 hours. They see photos and a report, never your store name. Your own store cannot bid on your unit."],
              ["03", "You see the top three to five", "Bid 1 through 5, net to you, no names. Take the top number or decline. No reserve, no obligation."],
              ["04", "Money first, then the unit", "The deal settles through Overbid and the buyer picks up after the funds clear. You are paid before the unit leaves your lot."],
            ].map(([n, t, d], i) => (
              <div className="step rv" key={n} style={{ "--d": `${i * 0.1}s` }}>
                <div className="n">{n}</div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- NUMBERS + EXAMPLE ---------- */}
      <section className="sec dark">
        <div className="wrap">
          <div className="kicker rv">What it looks like</div>
          <h2 className="rv">Five real bidders beat one wholesaler's phone call.</h2>
          <p className="lead rv" style={{ "--d": ".1s" }}>Today a unit you can't retail goes to an auction (fees, transport, two weeks of float) or to one wholesaler who shops it to two of his friends. Overbid puts it in front of the whole city.</p>
          <div className="stats">
            {[["$0", "to join or bid"], ["2 hrs", "from listing to top bids"], ["80+", "Calgary & Airdrie franchise stores"], ["0", "auction or transport fees"]].map(([v, k], i) => (
              <div className="rv" key={k} style={{ "--d": `${i * 0.08}s` }}><div className="v">{v}</div><div className="k">{k}</div></div>
            ))}
          </div>
          <div className="example rv">
            <div className="unit">2021 BMW X5 xDrive40i<small>61,000 km · one owner · illustrative example based on a test listing</small></div>
            <div className="row">
              <div><b>$48,500</b><span>Wholesaler's phone offer</span></div>
              <div><b>$51,500</b><span>Overbid top bid (of 5)</span></div>
              <div><b>– $1,000</b><span>Spread</span></div>
              <div className="hi"><b>$50,500</b><span>Net to the selling store</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FOR DEALERS ---------- */}
      <section className="sec" id="dealers">
        <div className="wrap">
          <div className="kicker rv">For dealers</div>
          <h2 className="rv">Built for the store, not against it.</h2>
          <div className="cols">
            <div className="col rv">
              <h3>When you are selling</h3>
              <ul>
                <li><b>More money on every wholesale unit.</b> Five real bidders beat one wholesaler's call that gets shopped to two of his friends. The first unit that brings $1,500 over the wholesaler's offer pays for the year.</li>
                <li><b>Pay the customer more for the trade.</b> Know the real wholesale number before you appraise, and hold the deal you would otherwise lose.</li>
                <li><b>Nothing to install.</b> A phone, a VIN and photos. Your lot attendant can list it. We build the report.</li>
                <li><b>Anonymous.</b> Your store name is never shown to bidders. Your own store is locked out of bidding.</li>
              </ul>
            </div>
            <div className="col rv" style={{ "--d": ".12s" }}>
              <h3>When you are buying</h3>
              <ul>
                <li><b>Local trades from stores you know.</b> Win it and it's a drive across town to pick up, not auction fees and a truck from Edmonton.</li>
                <li><b>Full picture before you bid.</b> Overbid's full market data report: relevant comps, potential recon costs, vehicle notes and Overbid's "My Take" on why it's a good buy for your lot. The work is done for your UCM, so he can bid a car on the fly and your store doesn't miss out on a car you should own.</li>
                <li><b>Free.</b> No membership, no buy fee, no transport. You pay the bid.</li>
                <li><b>Fill the holes in your lot</b> with trades other franchise stores don't have the market for.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- CUSTOMER ---------- */}
      <section className="sec dark">
        <div className="wrap customer">
          <div>
            <div className="kicker rv">For your customer</div>
            <div className="quote rv">The dealer pays more for the trade. <span className="o">The dealer stays the hero.</span></div>
          </div>
          <p className="lead rv" style={{ "--d": ".12s" }}>Every trade-in the dealer can't retail gets shopped to a network of real buyers instead of one wholesaler. The dealer can pay more for the trade, close the retail deal, and hand the customer a one-page Overbid summary showing the vehicle was put in front of the market. The customer never deals with Overbid.</p>
        </div>
      </section>

      {/* ---------- PRICING ---------- */}
      <section className="sec" id="pricing">
        <div className="wrap">
          <div className="kicker rv">What it costs</div>
          <h2 className="rv">Free to bid. A fixed spread when you sell.</h2>
          <div className="price">
            <div className="rv"><h3>Buying dealer</h3><div className="big">$0</div><p>$0 to join, $0 to bid. You pay the winning bid, nothing else.</p></div>
            <div className="rv" style={{ "--d": ".1s" }}><h3>Selling dealer</h3><div className="big">$500 / $1,000</div><p>$0 up front. A fixed spread comes off the top bid: $500 on units up to $50,000, $1,000 over $50,000. You see the net number before you say yes.</p></div>
            <div className="rv" style={{ "--d": ".2s" }}><h3>Settlement</h3><div className="big">Funds first</div><p>Both sides settle through Overbid. Funds clear before the unit leaves the seller's lot.</p></div>
          </div>
          <div className="offer rv">
            <Chev className="chev" />
            <div>
              <b>Founding-dealer offer.</b>
              <p>The first 25 Calgary and Airdrie stores to sell a unit on Overbid get their first three sales at a flat <b>$250 spread</b>, any price. Offer ends <b>February 28, 2027</b>.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- CLOSE ---------- */}
      <section className="sec dark close">
        <div className="wrap">
          <h2 className="rv">Get on <span style={{ color: "var(--orange)" }}>the network.</span></h2>
          <div className="acts rv" style={{ "--d": ".1s" }}>
            <a className="btn-lp primary lg" href="/d/login">Dealer sign in</a>
            <a className="btn-lp ghost lg" href="mailto:govan@overbid.ca?subject=Overbid%20for%20our%20store">Talk to Govan</a>
          </div>
          <p className="contact rv" style={{ "--d": ".2s" }}>Govan Bianchini, Managing Partner, 409 Motor Company · <a href="mailto:govan@overbid.ca">govan@overbid.ca</a></p>
        </div>
      </section>
      <footer className="lp-foot">
        <div className="wrap">
          <img src="/lockup-dark.png" alt="Overbid" />
          <span>A 409 Motor Company product · Airdrie, Alberta · <a href="/terms" style={{ color: "inherit" }}>Terms</a> · <a href="/login" style={{ color: "inherit" }}>Overbid team sign in</a></span>
        </div>
      </footer>
    </div>
  );
}
