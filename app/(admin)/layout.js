import Link from "next/link";
import Nav from "@/components/Nav";
import { currentUser } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }) {
  const user = await currentUser();
  return (
    <>
      <header className="topbar">
        <div className="inner">
          <Link href="/" className="brand">409 WHOLESALE<span className="hide-sm">DIVISION OF 409 MOTOR CO</span></Link>
          <Nav />
          <div className="who hide-sm">{user?.name}<a href="/logout">Sign out</a></div>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
