import { cookies } from "next/headers";
import Logo from "@/components/Logo";
import { redirect } from "next/navigation";
import { COOKIE, sign } from "@/lib/session";

async function login(formData) {
  "use server";
  const pw = String(formData.get("password") || "");
  const name = String(formData.get("name") || "").trim();
  const next = String(formData.get("next") || "/");
  let role = null;
  if (process.env.ADMIN_PASSWORD && pw === process.env.ADMIN_PASSWORD) role = "admin";
  else if (process.env.STAFF_PASSWORD && pw === process.env.STAFF_PASSWORD) role = "staff";
  if (!role) redirect(`/login?err=1${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`);
  const c = await cookies();
  c.set(COOKIE, await sign(role, name || (role === "admin" ? "Admin" : "Staff")), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  redirect(role === "staff" ? (next.startsWith("/gtm") ? next : "/gtm") : next.startsWith("/") ? next : "/");
}

export default async function Login({ searchParams }) {
  const sp = await searchParams;
  return (
    <div className="center-card">
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div className="brand"><Logo size={30} /></div>
        <div className="muted small" style={{ marginTop: 4 }}>By 409 Motor Company</div>
      </div>
      <form action={login} className="card">
        <div className="bd stack">
          {sp?.err && <div className="notice bad">That password didn't work.</div>}
          <input type="hidden" name="next" value={sp?.next || "/"} />
          <label className="f"><span>Your name</span><input type="text" name="name" autoComplete="name" placeholder="e.g. Kevin" /></label>
          <label className="f"><span>Password</span><input type="password" name="password" autoComplete="current-password" required autoFocus /></label>
          <button className="btn primary block lg">Sign in</button>
        </div>
      </form>
    </div>
  );
}
