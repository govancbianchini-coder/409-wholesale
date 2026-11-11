import Link from "next/link";
import { LABEL, RANK } from "@/lib/gtm";

export default function StoreRow({ t }) {
  const done = (RANK[t.eff] ?? 0) >= 4;
  const who = t.gsm ? `GSM ${t.gsm}` : t.gm ? `GM ${t.gm}` : "Ask for the GSM";
  return (
    <Link href={`/gtm/store/${t.id}`} className={`store ${done ? "done" : ""}`}>
      <div className="ro">{t.route_order}</div>
      <div className="grow">
        <div className="nm">{t.dealership}</div>
        <div className="sub">{who}{t.priority === "A" ? " · A" : ""}{t.next_at ? ` · next ${String(t.next_at).slice(0, 10)}` : ""}</div>
      </div>
      <span className={`pill st ${t.eff}`}>{LABEL[t.eff]}</span>
    </Link>
  );
}
