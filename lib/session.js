// Tiny signed-cookie session. Works in both Edge (middleware) and Node (server actions).
// Staff/admin cookie: ws_session  → { role: admin|staff, name }
// Dealer cookie:      ob_dealer   → { role: dealer, name, cid (contact id), did (dealership id) }
export const COOKIE = "ws_session";
export const DEALER_COOKIE = "ob_dealer";

function secret() {
  return process.env.SESSION_SECRET || "dev-only-secret-change-me";
}

async function hmac(data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// value = role.name.exp.sig          (staff/admin)
//       = dealer.name.exp.cid.did.sig (dealer)
export async function sign(role, name, extra = {}) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * (role === "dealer" ? 90 : 30);
  const safeName = encodeURIComponent(name || role);
  const body = role === "dealer" ? `dealer.${safeName}.${exp}.${extra.cid}.${extra.did || 0}` : `${role}.${safeName}.${exp}`;
  return `${body}.${await hmac(body)}`;
}

export async function verify(value) {
  if (!value) return null;
  const parts = value.split(".");
  const sig = parts.pop();
  const body = parts.join(".");
  if ((await hmac(body)) !== sig) return null;
  const [role, name, exp, cid, did] = parts;
  if (Number(exp) < Date.now()) return null;
  if (role === "admin" || role === "staff") return { role, name: decodeURIComponent(name) };
  if (role === "dealer" && cid) return { role, name: decodeURIComponent(name), cid: Number(cid), did: Number(did) || null };
  return null;
}
