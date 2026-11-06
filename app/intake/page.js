import Link from "next/link";
import ContactForm from "@/components/ContactForm";
import { createContact } from "@/lib/contacts";
import { currentUser } from "@/lib/util";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Intake() {
  const user = await currentUser();
  const mine = await one(`SELECT count(*)::int n FROM contacts WHERE created_by = $1`, [user?.name]);
  const total = await one(`SELECT count(*)::int n, count(DISTINCT lower(dealership))::int stores FROM contacts WHERE NOT archived`);
  return (
    <>
      <header className="topbar">
        <div className="inner">
          <span className="brand">OVERBID</span>
          {user?.role === "admin" ? <Link href="/" className="who" style={{ marginLeft: "auto", color: "#c9c5bd" }}>← Dashboard</Link> : <div className="who">{user?.name}<a href="/logout">Sign out</a></div>}
        </div>
      </header>
      <main className="page" style={{ maxWidth: 640 }}>
        <div className="page-head">
          <div>
            <h1>Add a dealer</h1>
            <p>{user?.name ? `${user.name}, you've added ${mine?.n || 0}.` : ""} Network: {total.n} contacts across {total.stores} stores.</p>
          </div>
        </div>
        <div className="card"><div className="bd"><ContactForm action={createContact} /></div></div>
      </main>
    </>
  );
}
