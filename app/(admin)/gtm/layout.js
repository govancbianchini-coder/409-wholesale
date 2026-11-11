import GtmTabs from "@/components/GtmTabs";

export const dynamic = "force-dynamic";

export default function GtmLayout({ children }) {
  return (
    <div className="gtm">
      <GtmTabs />
      {children}
    </div>
  );
}
