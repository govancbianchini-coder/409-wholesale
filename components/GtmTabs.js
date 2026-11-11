"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function GtmTabs() {
  const p = usePathname();
  const on = (h) => (h === "/gtm" ? p === "/gtm" || p.startsWith("/gtm/store") : p.startsWith(h));
  return (
    <div className="gtm-tabs">
      <Link href="/gtm" className={on("/gtm") ? "on" : ""}>Today</Link>
      <Link href="/gtm/stores" className={on("/gtm/stores") ? "on" : ""}>Stores</Link>
      <Link href="/gtm/board" className={on("/gtm/board") ? "on" : ""}>Board</Link>
    </div>
  );
}
