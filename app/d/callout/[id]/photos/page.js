import { notFound, redirect } from "next/navigation";
import { q, one } from "@/lib/db";
import { currentDealer, int, title } from "@/lib/util";
import { SHOTS } from "@/lib/shots";
import PhotoWizard from "./PhotoWizard";

export const dynamic = "force-dynamic";

export default async function Photos({ params }) {
  const { id } = await params;
  const d = await currentDealer();
  const v = await one(`SELECT * FROM vehicles WHERE id = $1 AND submitted_by = $2`, [int(id), d.cid]);
  if (!v) notFound();
  if (v.status !== "draft") redirect(`/d/callout/${v.id}`);
  const photos = await q(`SELECT slot, url FROM photos WHERE vehicle_id = $1 AND slot IS NOT NULL`, [v.id]);
  const have = Object.fromEntries(photos.map((p) => [p.slot, p.url]));
  return <PhotoWizard vehicleId={v.id} titleText={title(v)} shots={SHOTS} have={have} notes={v.dealer_notes || ""} />;
}
