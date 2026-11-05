import Link from "next/link";
import { notFound } from "next/navigation";
import UnitForm from "@/components/UnitForm";
import { saveVehicle } from "@/lib/units";
import { one } from "@/lib/db";
import { int, title, TZ } from "@/lib/util";

function toLocalInput(d) {
  if (!d) return "";
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export default async function EditUnit({ params }) {
  const { id } = await params;
  const v = await one(`SELECT * FROM vehicles WHERE id = $1`, [int(id)]);
  if (!v) notFound();
  const initial = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x ?? ""]));
  initial.closes_at = toLocalInput(v.closes_at);
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <div className="page-head"><div><div className="small"><Link href={`/units/${v.id}`} className="muted">{title(v)}</Link></div><h1>Edit unit</h1></div></div>
      <UnitForm action={saveVehicle} initial={initial} />
    </div>
  );
}
