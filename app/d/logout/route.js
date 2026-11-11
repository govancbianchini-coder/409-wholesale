import { NextResponse } from "next/server";
import { DEALER_COOKIE } from "@/lib/session";

export async function GET(req) {
  const res = NextResponse.redirect(new URL("/d/login", req.url));
  res.cookies.set(DEALER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
