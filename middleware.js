import { NextResponse } from "next/server";
import { COOKIE, DEALER_COOKIE, verify } from "./lib/session";

// Public: dealer bid links, unsubscribe, terms, logins, Twilio webhook, report API (does its own auth), static files.
const PUBLIC = [/^\/b\//, /^\/u\//, /^\/terms/, /^\/login/, /^\/api\/twilio/, /^\/api\/units\/[^/]+\/report$/, /^\/_next/, /^\/uploads\//, /^\/favicon/, /^\/brand/, /^\/d\/login/, /^\/d\/code/, /^\/d\/join\//, /^\/d\/logout/];
// Staff (e.g. Kevin) may only use the intake form.
const STAFF_OK = [/^\/intake/, /^\/logout/];
// Dealer area and the APIs a dealer needs (upload, VIN decode).
const DEALER_AREA = [/^\/d(\/|$)/, /^\/api\/upload/, /^\/api\/vin/];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();

  const staff = await verify(req.cookies.get(COOKIE)?.value);
  const dealer = await verify(req.cookies.get(DEALER_COOKIE)?.value);

  if (DEALER_AREA.some((r) => r.test(pathname))) {
    if (dealer || staff?.role === "admin") return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/d/login";
    url.search = pathname.startsWith("/d") && pathname !== "/d" ? `?next=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }

  if (!staff) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  if (staff.role === "staff" && !STAFF_OK.some((r) => r.test(pathname))) {
    const url = req.nextUrl.clone();
    url.pathname = "/intake";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
