"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/", "Dashboard"],
  ["/units", "Units"],
  ["/dealers", "Dealers"],
  ["/intake", "Add dealer"],
  ["/gtm", "Sign-ups"],
];

export default function Nav() {
  const p = usePathname();
  return (
    <nav className="nav">
      {LINKS.map(([href, label]) => {
        const on = href === "/" ? p === "/" : p.startsWith(href);
        return (
          <Link key={href} href={href} className={on ? "on" : ""}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
