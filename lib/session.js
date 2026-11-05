// Tiny signed-cookie session. Works in both Edge (middleware) and Node (server actions).
export const COOKIE = "ws_session";

function secret() {
  return process.env.SESSION_SECRET || "dev-only-secret-change-me";
}

async function hmac(data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// value = role.name.expires.sig
export async function sign(role, name) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30;
  const safeName = encodeURIComponent(name || role);
  const body = `${role}.${safeName}.${exp}`;
  return `${body}.${await hmac(body)}`;
}

export async function verify(value) {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [role, name, exp, sig] = parts;
  if (Number(exp) < Date.now()) return null;
  if ((await hmac(`${role}.${name}.${exp}`)) !== sig) return null;
  if (role !== "admin" && role !== "staff") return null;
  return { role, name: decodeURIComponent(name) };
}
