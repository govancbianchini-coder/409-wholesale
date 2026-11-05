import crypto from "node:crypto";
import { cookies } from "next/headers";
import { COOKIE, verify } from "./session";

export function token(len = 18) {
  return crypto.randomBytes(len).toString("base64url");
}

export async function currentUser() {
  const c = await cookies();
  return verify(c.get(COOKIE)?.value);
}

export function appUrl() {
  const u = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  return u.replace(/\/$/, "");
}

export const TZ = "America/Edmonton";

export function money(n) {
  if (n === null || n === undefined || n === "") return "—";
  return "$" + Number(n).toLocaleString("en-CA", { maximumFractionDigits: 0 });
}

export function km(n) {
  if (n === null || n === undefined || n === "") return "—";
  return Number(n).toLocaleString("en-CA") + " km";
}

export function when(d, opts) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-CA", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", ...opts });
}

export function ago(d) {
  if (!d) return "—";
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return when(d, { weekday: undefined, hour: undefined, minute: undefined });
}

export function title(v) {
  return [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ") || "Untitled unit";
}

export function int(v) {
  if (v === null || v === undefined) return null;
  const n = parseInt(String(v).replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

export function str(v) {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

// Normalize to E.164 for North American numbers.
export function phoneE164(raw) {
  if (!raw) return null;
  const d = String(raw).replace(/\D/g, "");
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d.startsWith("1")) return "+" + d;
  if (String(raw).trim().startsWith("+") && d.length >= 10) return "+" + d;
  return null;
}

export function phonePretty(e164) {
  if (!e164) return "—";
  const d = e164.replace(/\D/g, "").slice(-10);
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

// Effective status: a live unit past its close time is "closed" (awaiting decision).
export function effectiveStatus(v) {
  if (v.status === "live" && v.closes_at && new Date(v.closes_at) < new Date()) return "closed";
  return v.status;
}

export const STATUS_LABEL = {
  draft: "Draft",
  live: "Live",
  closed: "Awaiting decision",
  awarded: "Sold",
  no_sale: "No sale",
};
