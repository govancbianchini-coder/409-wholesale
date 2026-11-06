import { notFound } from "next/navigation";
import { q, one } from "@/lib/db";

export const dynamic = "force-dynamic";

async function unsubscribe(fd) {
  "use server";
  const t = String(fd.get("token"));
  const what = String(fd.get("what"));
  if (what === "all") await q(`UPDATE contacts SET email_opt_out = TRUE, sms_opt_out = TRUE, updated_at = now() WHERE token = $1`, [t]);
  else if (what === "email") await q(`UPDATE contacts SET email_opt_out = TRUE, updated_at = now() WHERE token = $1`, [t]);
  else if (what === "sms") await q(`UPDATE contacts SET sms_opt_out = TRUE, updated_at = now() WHERE token = $1`, [t]);
  else if (what === "resub") await q(`UPDATE contacts SET email_opt_out = FALSE, updated_at = now() WHERE token = $1`, [t]);
  const { redirect } = await import("next/navigation");
  redirect(`/u/${t}?done=${what}`);
}

export default async function Unsub({ params, searchParams }) {
  const { token } = await params;
  const sp = await searchParams;
  const c = await one(`SELECT * FROM contacts WHERE token = $1`, [token]);
  if (!c) notFound();
  return (
    <div className="center-card">
      <div className="brand" style={{ textAlign: "center", marginBottom: 18 }}>OVERBID</div>
      <div className="card"><div className="bd stack">
        {sp?.done && sp.done !== "resub" ? (
          <>
            <h2>You're unsubscribed</h2>
            <p className="small ink2" style={{ margin: 0 }}>{sp.done === "all" ? "You won't get any more emails or texts from Overbid." : sp.done === "email" ? "No more emails. Texts are unchanged." : "No more texts. Emails are unchanged."} Changed your mind? Call 403.808.1801.</p>
            {sp.done !== "sms" && <form action={unsubscribe}><input type="hidden" name="token" value={token} /><input type="hidden" name="what" value="resub" /><button className="linkbtn small">Undo, keep sending me emails</button></form>}
          </>
        ) : sp?.done === "resub" ? (
          <><h2>You're back on the list</h2><p className="small ink2" style={{ margin: 0 }}>Thanks, {c.first_name}.</p></>
        ) : (
          <>
            <h2>Unsubscribe, {c.first_name}?</h2>
            <p className="small ink2" style={{ margin: 0 }}>Choose what you'd like to stop receiving from Overbid.</p>
            <form action={unsubscribe} className="stack-sm">
              <input type="hidden" name="token" value={token} />
              <button className="btn primary block" name="what" value="all">Stop everything</button>
              {c.email && <button className="btn block" name="what" value="email">Stop emails only</button>}
              {c.phone && <button className="btn block" name="what" value="sms">Stop texts only</button>}
            </form>
          </>
        )}
      </div></div>
      <p className="xs muted" style={{ textAlign: "center", marginTop: 14 }}>409 Motor Company · 101 Highland Park Common NE, Airdrie, AB T4A 0X3</p>
    </div>
  );
}
