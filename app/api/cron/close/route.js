import { sweepClosed } from "@/lib/close";

// Hit by Vercel Cron or any scheduler. Secure with CRON_SECRET when set.
export const dynamic = "force-dynamic";
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  const n = await sweepClosed();
  return Response.json({ ok: true, notified: n });
}
