import Link from "next/link";
import Logo from "@/components/Logo";
import Nav from "@/components/Nav";
import { currentUser } from "@/lib/util";

import { sweepClosed } from "@/lib/close";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }) {
  const user = await currentUser();
  await sweepClosed();
  return (
    <>
      <header className="topbar">
        <div className="inner">
          <Link href="/" className="brand"><Logo size={24} sub={<span className="hide-sm">BY 409 MOTOR CO</span>} /></Link>
          <Nav />
          <div className="who hide-sm">{user?.name}<a href="/logout">Sign out</a></div>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
