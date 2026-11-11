import { currentDealer } from "@/lib/util";
import DealerNav from "@/components/DealerNav";

export const dynamic = "force-dynamic";

export default async function DealerLayout({ children }) {
  const d = await currentDealer();
  return (
    <>
      <header className="dtop">
        <div className="inner">
          <a href={d ? "/d" : "/d/login"} className="brand">OVERBID</a>
          {d ? <DealerNav name={d.name} /> : <span className="xs" style={{ color: "#9b968d" }}>Dealer portal</span>}
        </div>
      </header>
      <main className="dshell">{children}</main>
    </>
  );
}
