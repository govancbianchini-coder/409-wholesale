import { notFound } from "next/navigation";
import { one } from "@/lib/db";
import JoinClient from "./JoinClient";

export const dynamic = "force-dynamic";

export default async function Join({ params }) {
  const { token } = await params;
  const d = await one(`SELECT name, brand, invite_token FROM dealerships WHERE invite_token = $1 AND status = 'active'`, [token]);
  if (!d) notFound();
  return <JoinClient dealership={d} />;
}
