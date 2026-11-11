"use client";
import { usePathname } from "next/navigation";

export default function DealerNav({ name }) {
  const p = usePathname();
  const on = (h) => (h === "/d" ? p === "/d" : p.startsWith(h));
  return (
    <nav>
      <a href="/d" className={on("/d") ? "on" : ""}>Units</a>
      <a href="/d/callout/new" className={on("/d/callout") ? "on" : ""}>Call out</a>
      <a href="/d/prefs" className={on("/d/prefs") ? "on" : ""}>{name}</a>
    </nav>
  );
}
