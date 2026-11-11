export default function Logo({ size = 22, sub, light = false, href, style }) {
  const inner = (
    <span className="logo" style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.45), textDecoration: "none", color: "inherit", ...style }}>
      <img src="/mark.svg" alt="" width={size} height={size} style={{ display: "block" }} />
      <span style={{ fontWeight: 900, letterSpacing: ".16em", fontSize: Math.round(size * 0.62), lineHeight: 1, color: light ? "#0B0F17" : "#F3EFE6" }}>OVERBID</span>
      {sub && <span className="logo-sub">{sub}</span>}
    </span>
  );
  return href ? <a href={href} style={{ textDecoration: "none" }}>{inner}</a> : inner;
}
