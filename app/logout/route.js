import { NextResponse } from "next/server";
import { COOKIE } from "@/lib/session";

export async function GET(req) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
