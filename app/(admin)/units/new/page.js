import Link from "next/link";
import UnitForm from "@/components/UnitForm";
import { saveVehicle } from "@/lib/units";

export default function NewUnit() {
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <div className="page-head"><div><div className="small"><Link href="/units" className="muted">Units</Link></div><h1>New unit</h1><p>Details first. Photos and sending come next.</p></div></div>
      <UnitForm action={saveVehicle} />
    </div>
  );
}
