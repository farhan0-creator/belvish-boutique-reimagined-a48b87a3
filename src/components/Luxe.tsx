import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

/** Brand reveal shown once per browser session. */
export function IntroCurtain() {
  const [phase, setPhase] = useState<"show" | "leave" | "gone">("show");
  useEffect(() => {
    if (sessionStorage.getItem("belvish-intro")) { setPhase("gone"); return; }
    sessionStorage.setItem("belvish-intro", "1");
    const a = setTimeout(() => setPhase("leave"), 1900);
    const b = setTimeout(() => setPhase("gone"), 2900);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  if (phase === "gone") return null;
  return (
    <div aria-hidden className={`lux-curtain fixed inset-0 z-[200] grid place-items-center bg-background transition-all duration-1000 ${phase === "leave" ? "pointer-events-none opacity-0 [clip-path:inset(0_0_100%_0)]" : "[clip-path:inset(0_0_0_0)]"}`}>
      <div className="text-center">
        <p className="lux-letters font-display text-5xl tracking-[0.6em] text-gold-gradient md:text-7xl">BELVISH</p>
        <div className="lux-line mx-auto mt-6 h-px w-48 gold-rule" />
        <p className="mt-6 text-[10px] uppercase tracking-[0.5em] text-muted-foreground">Maison de Parfum</p>
      </div>
    </div>
  );
}

/** Fades sections up as they scroll into view. Content stays visible without JS. */
export function RevealOnScroll() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>("main section, main > div > section, footer"));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.setAttribute("data-reveal", "in"); io.unobserve(e.target); } });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight) return;
      // A data attribute (not className) so React hydration never sees a mismatch.
      el.setAttribute("data-reveal", "");
      io.observe(el);
    });
    return () => io.disconnect();
  }, [path]);
  return null;
}

/** Soft champagne light that follows the pointer on desktop. */
export function CursorGlow() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    let raf = 0;
    const on = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setPos({ x: e.clientX, y: e.clientY }));
    };
    window.addEventListener("pointermove", on, { passive: true });
    return () => { window.removeEventListener("pointermove", on); cancelAnimationFrame(raf); };
  }, []);
  if (!pos) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] mix-blend-screen"
      style={{ background: `radial-gradient(420px circle at ${pos.x}px ${pos.y}px, color-mix(in oklab, var(--primary) 9%, transparent), transparent 70%)` }}
    />
  );
}

/** Splits a fragrance's notes into a top / heart / base pyramid. */
export function ScentPyramid({ notes }: { notes: string[] }) {
  const n = notes.length;
  const a = Math.max(1, Math.ceil(n / 3));
  const b = Math.max(a + 1, Math.ceil((2 * n) / 3));
  const tiers = [
    { label: "Top", hint: "First impression · minutes", items: notes.slice(0, a), w: "w-2/3" },
    { label: "Heart", hint: "The character · hours", items: notes.slice(a, b), w: "w-5/6" },
    { label: "Base", hint: "The memory · lingers", items: notes.slice(b), w: "w-full" },
  ].filter((t) => t.items.length);
  return (
    <div className="mt-8 rounded-3xl border border-border bg-card/60 p-6 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.3em] text-accent">Olfactory pyramid</p>
      <div className="mt-5 flex flex-col items-center gap-3">
        {tiers.map((t) => (
          <div key={t.label} className={`${t.w} rounded-full border border-border bg-gradient-to-r from-transparent via-primary/10 to-transparent px-5 py-3 text-center`}>
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{t.label} · {t.hint}</p>
            <p className="mt-1 font-display text-xl">{t.items.join(" · ")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const SEALS = [
  ["100%", "Authentic, sealed"],
  ["Free", "Gift wrapping"],
  ["Free", "Delivery across India"],
  ["COD", "Pay when it arrives"],
];

export function LuxeSeals() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {SEALS.map(([k, v]) => (
        <div key={v} className="rounded-2xl border border-border p-4 text-center">
          <p className="font-display text-2xl text-gold-gradient">{k}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{v}</p>
        </div>
      ))}
    </div>
  );
}
