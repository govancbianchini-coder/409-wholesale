import { one } from "@/lib/db";
import { currentDealer } from "@/lib/util";
import PrefsClient from "./PrefsClient";

export const dynamic = "force-dynamic";

export default async function Prefs() {
  const d = await currentDealer();
  const dealership = await one(`SELECT * FROM dealerships WHERE id = $1`, [d.did]);
  const me = await one(`SELECT first_name, last_name, email, phone, role FROM contacts WHERE id = $1`, [d.cid]);
  return <PrefsClient dealership={dealership} me={me} />;
}
