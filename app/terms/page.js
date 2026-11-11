import Logo from "@/components/Logo";
export const metadata = { title: "Bid terms · Overbid" };

export default function Terms() {
  return (
    <>
      <div className="pub-top"><div className="inner"><span className="brand"><Logo size={24} /></span></div></div>
      <div className="prose">
        <h1>Wholesale bid terms</h1>
        <p className="small">Overbid is a dealer-to-dealer wholesale platform operated by 409 Motor Company, 101 Highland Park Common NE, Airdrie, AB T4A 0X3 · 403.808.1801. These terms apply to every bid placed through a Overbid link.</p>

        <h2>1. Who can bid</h2>
        <p>Bidding is open only to licensed automotive dealers and wholesalers that 409 has invited. Each link is personal to the dealer it was sent to. Bids are placed on behalf of that dealership.</p>

        <h2>2. Bids are blind and binding</h2>
        <p>No bidder sees anyone else's bid. You may change your bid any time before the posted close time. When bidding closes, your most recent bid is a firm offer to buy the unit at that price. 409 may accept it, decline it, or decline all bids. Nothing is sold until 409 confirms it to you.</p>

        <h2>3. Condition and disclosure</h2>
        <p>Units are sold as-is, where-is, as described. 409 describes each unit in good faith from its own inspection, the photos, and the history report provided. Announcements (prior damage, out-of-province, missing keys, warning lights and similar) are part of the description. Inspection before pickup can be arranged by appointment.</p>

        <h2>4. Arbitration</h2>
        <p>If a unit has a material undisclosed issue, the buyer must raise it with 409 in writing within 48 hours of pickup and before any reconditioning. Covered issues include frame or structural damage, flood or fire damage, title or lien problems, odometer discrepancy, and major engine or transmission failure. 409 will either agree to an adjustment or take the unit back and refund the purchase price. Wear items, cosmetic condition and anything announced or visible in the photos are not grounds for arbitration.</p>

        <h2>5. Payment, paperwork and pickup</h2>
        <p>Payment in full is due within 2 business days of acceptance by wire transfer, bank draft or approved dealer cheque. GST applies. Title passes and the unit is released once funds clear. The buyer picks up from the stated location within 3 business days of payment. After that, storage may be charged.</p>

        <h2>6. Failure to complete</h2>
        <p>A buyer who doesn't complete an accepted bid may be removed from future Overbid offers.</p>

        <h2>7. Messages</h2>
        <p>You get Overbid offers by email and/or text because you agreed to. You can opt out any time with the unsubscribe link in any email, by replying STOP to any text, or by calling 403.808.1801.</p>

        <p className="xs muted" style={{ marginTop: 28 }}>Last updated: November 2026.</p>
      </div>
    </>
  );
}
