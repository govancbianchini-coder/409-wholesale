"use client";
import { useEffect } from "react";

// Adds .in to every .rv element as it scrolls into view, flips the header to light over cream sections,
// and plays the hero fill once fonts are ready.
export default function Reveal() {
  useEffect(() => {
    const root = document.querySelector(".lp");
    if (!root) return;
    const els = root.querySelectorAll(".rv");
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    els.forEach((el) => io.observe(el));

    const head = root.querySelector(".lp-head");
    const darks = [...root.querySelectorAll(".hero, .sec.dark, .lp-foot")];
    const onScroll = () => {
      const y = 64;
      const overDark = darks.some((d) => { const r = d.getBoundingClientRect(); return r.top <= y && r.bottom > y; });
      head?.classList.toggle("light", !overDark);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const hero = root.querySelector(".hero");
    const t = setTimeout(() => hero?.classList.add("ready"), 150);
    return () => { io.disconnect(); window.removeEventListener("scroll", onScroll); clearTimeout(t); };
  }, []);
  return null;
}
