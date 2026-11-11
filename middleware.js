import { NextResponse } from "next/server";
import { COOKIE, verify } from "./lib/session";

// Public routes: dealer bid pages, unsubscribe, terms, login, Twilio webhook, static files.
const PUBLIC = [/^\/b\//, /^\/u\//, /^\/terms/, /^\/login/, /^\/api\/twilio/, /^\/api\/units\/[^/]+\/report$/, /^\/_next/, /^\/uploads\//, /^\/favicon/, /^\/brand/];
// Staff (e.g. Kevin) may only use the intake form.
const STAFF_OK = [/^\/intake/, /^\/logout/];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();

  const session = await verify(req.cookies.get(COOKIE)?.value);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  if (session.role === "staff" && !STAFF_OK.some((r) => r.test(pathname))) {
    const url = req.nextUrl.clone();
    url.pathname = "/intake";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
