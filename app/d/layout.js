import { currentDealer } from "@/lib/util";
import Logo from "@/components/Logo";
import DealerNav from "@/components/DealerNav";

import { sweepClosed } from "@/lib/close";

export const dynamic = "force-dynamic";

export default async function DealerLayout({ children }) {
  const d = await currentDealer();
  await sweepClosed();
  return (
    <>
      <header className="dtop">
        <div className="inner">
          <a href={d ? "/d" : "/d/login"} className="brand"><Logo size={24} /></a>
          {d ? <DealerNav name={d.name} /> : <span className="xs" style={{ color: "var(--muted)" }}>Dealer portal</span>}
        </div>
      </header>
      <main className="dshell">{children}</main>
    </>
  );
}
