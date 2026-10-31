import { useEffect, useRef, useState, type MouseEvent, type RefObject } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, Eye, Search, ShoppingBag, Sparkles } from "lucide-react";
import { families, formatINR, products, type Product } from "@/lib/catalog";
import { useCart } from "@/lib/cart";
import { WishButton } from "@/components/Extras";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/* ---------- Search palette: header button, "/" and Ctrl/⌘+K ---------- */
export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  const go = (fn: () => void) => { setOpen(false); fn(); };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Search fragrances" className="group flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground">
        <Search className="h-5 w-5" />
        <kbd className="hidden rounded-full border border-border px-2 py-0.5 text-[10px] tracking-normal xl:inline">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search a name, house or note — oud, rose, vanilla…" />
        <CommandList className="max-h-[60vh]">
          <CommandEmpty>Nothing matches. Try a single note like “jasmine”.</CommandEmpty>
          <CommandGroup heading="Fragrances">
            {products.map((p) => (
              <CommandItem key={p.slug} value={`${p.name} ${p.house} ${p.notes.join(" ")} ${p.tags.join(" ")}`} onSelect={() => go(() => navigate({ to: "/product/$slug", params: { slug: p.slug } }))} className="gap-4">
                <img src={p.images[0]} alt="" className="h-12 w-12 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg leading-tight">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.house} · {p.notes.slice(0, 3).join(", ")}</p>
                </div>
                <span className="text-sm text-accent">{formatINR(p.price)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Scent families">
            {families.map((f) => (
              <CommandItem key={f.name} value={`family ${f.name} ${f.line}`} onSelect={() => go(() => navigate({ to: "/shop", search: { family: f.name } }))}>
                <Sparkles className="text-accent" /> {f.name} <span className="ml-2 truncate text-xs text-muted-foreground">{f.line}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Explore">
            <CommandItem value="fragrance finder quiz" onSelect={() => go(() => navigate({ to: "/finder" }))}><ArrowRight className="text-accent" /> Take the fragrance finder</CommandItem>
            <CommandItem value="full edit shop all" onSelect={() => go(() => navigate({ to: "/shop" }))}><ArrowRight className="text-accent" /> Browse the full edit</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

/* ---------- Quick view on product cards ---------- */
export function QuickView({ p }: { p: Product }) {
  const [open, setOpen] = useState(false);
  const { add } = useCart();
  const stop = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); };
  return (
    <>
      <button type="button" onClick={(e) => { stop(e); setOpen(true); }} aria-label={`Quick view ${p.name}`} className="absolute left-3 top-14 grid h-10 w-10 place-items-center rounded-full bg-background/80 backdrop-blur transition-all duration-500 hover:text-accent md:translate-x-[-6px] md:opacity-0 md:group-hover:translate-x-0 md:group-hover:opacity-100">
        <Eye className="h-4 w-4" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()} className="max-w-3xl overflow-hidden rounded-[2rem] border-border p-0 sm:rounded-[2rem]">
          <div className="grid md:grid-cols-2">
            <img src={p.images[0]} alt={`${p.name} by ${p.house}`} className="aspect-[4/5] h-full w-full object-cover" />
            <div className="flex flex-col p-8">
              <p className="text-[10px] uppercase tracking-[0.3em] text-accent">{p.house} · {p.tier}</p>
              <DialogTitle className="mt-3 font-display text-4xl font-light">{p.name}</DialogTitle>
              <DialogDescription className="mt-3 text-sm leading-relaxed">{p.description}</DialogDescription>
              <div className="mt-5 flex flex-wrap gap-2">{p.notes.map((n) => <span key={n} className="rounded-full border border-border px-3 py-1 text-xs">{n}</span>)}</div>
              <p className="mt-5 text-xs text-muted-foreground">{p.concentration} · {p.volume}</p>
              <p className="mt-2 font-display text-3xl text-gold-gradient">{formatINR(p.price)}</p>
              <div className="mt-auto flex gap-3 pt-8">
                <button type="button" onClick={() => { add(p.slug); setOpen(false); }} className="btn-gold flex-1"><ShoppingBag className="h-4 w-4" /> Add to bag</button>
                <WishButton slug={p.slug} className="border border-border" />
              </div>
              <Link to="/product/$slug" params={{ slug: p.slug }} onClick={() => setOpen(false)} className="mt-4 text-center text-xs uppercase tracking-[0.2em] text-accent underline underline-offset-8">View full details</Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------- Product page: hover zoom on the main photo ---------- */
export function ZoomImage({ src, alt }: { src: string; alt: string }) {
  const [origin, setOrigin] = useState<string | null>(null);
  return (
    <div
      className="relative overflow-hidden rounded-[2rem] md:cursor-zoom-in"
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
      }}
      onPointerLeave={() => setOrigin(null)}
    >
      <img src={src} alt={alt} className="aspect-[4/5] w-full object-cover transition-transform duration-300 ease-out" style={origin ? { transform: "scale(1.9)", transformOrigin: origin } : undefined} />
      <span className="pointer-events-none absolute bottom-4 left-4 hidden rounded-full bg-background/75 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground backdrop-blur md:inline">Hover to zoom</span>
    </div>
  );
}

/* ---------- Product page: breadcrumb ---------- */
export function Crumbs({ p }: { p: Product }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
      <Link to="/" className="hover:text-accent">Home</Link><ChevronRight className="h-3 w-3" />
      <Link to="/shop" search={{}} className="hover:text-accent">The edit</Link><ChevronRight className="h-3 w-3" />
      <Link to="/shop" search={{ family: p.families[0] }} className="hover:text-accent">{p.families[0]}</Link><ChevronRight className="h-3 w-3" />
      <span className="text-foreground">{p.name}</span>
    </nav>
  );
}

/* ---------- Product page: longevity & projection, typical for the concentration ---------- */
const STRENGTH: Record<string, { longevity: number; sillage: number; hours: string }> = {
  "Extrait de Parfum": { longevity: 5, sillage: 4, hours: "8–12+ hours" },
  "Eau de Parfum": { longevity: 4, sillage: 3, hours: "6–8 hours" },
  "Eau de Toilette": { longevity: 3, sillage: 2, hours: "3–5 hours" },
};

export function ScentProfile({ p }: { p: Product }) {
  const s = STRENGTH[p.concentration];
  if (!s) return null;
  const Meter = ({ label, value }: { label: string; value: number }) => (
    <div>
      <div className="flex justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground"><span>{label}</span><span className="text-accent">{value}/5</span></div>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {Array.from({ length: 5 }, (_, i) => <span key={i} className={`h-1.5 rounded-full ${i < value ? "bg-primary" : "bg-muted"}`} />)}
      </div>
    </div>
  );
  return (
    <div className="mt-8 rounded-3xl border border-border bg-card/60 p-6 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.3em] text-accent">How it wears</p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Meter label="Longevity" value={s.longevity} />
        <Meter label="Projection" value={s.sillage} />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Typical for an {p.concentration.toLowerCase()}: around {s.hours} on skin. Wear varies with skin and weather.</p>
    </div>
  );
}

/* ---------- Product page: sticky buy bar once the main button scrolls away ---------- */
export function StickyBuyBar({ p, qty, target }: { p: Product; qty: number; target: RefObject<HTMLElement | null> }) {
  const [show, setShow] = useState(false);
  const { add } = useCart();
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [target, p.slug]);
  return (
    <div aria-hidden={!show} className={`fixed inset-x-0 bottom-0 z-30 px-3 pb-3 transition-all duration-500 ${show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"}`}>
      <div className="mx-auto flex max-w-4xl items-center gap-4 rounded-full border border-border bg-background/85 py-2 pl-2 pr-2 shadow-2xl backdrop-blur-md sm:pr-3">
        <img src={p.images[0]} alt="" className="h-12 w-12 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg leading-tight">{p.name}</p>
          <p className="truncate text-xs text-muted-foreground">{p.volume} · {formatINR(p.price)}</p>
        </div>
        <button type="button" tabIndex={show ? 0 : -1} onClick={() => add(p.slug, qty)} className="btn-gold !px-6 !py-3"><ShoppingBag className="h-4 w-4" /> <span className="hidden sm:inline">Add to bag</span></button>
      </div>
    </div>
  );
}

/* ---------- Bag: pairing suggestions ---------- */
export function CompleteRitual({ inBag }: { inBag: Product[] }) {
  const { add } = useCart();
  if (!inBag.length) return null;
  const taken = new Set(inBag.map((p) => p.slug));
  const fams = new Set(inBag.flatMap((p) => p.families));
  const picks = products
    .filter((p) => !taken.has(p.slug))
    .sort((a, b) => b.families.filter((f) => fams.has(f)).length - a.families.filter((f) => fams.has(f)).length)
    .slice(0, 2);
  if (!picks.length) return null;
  return (
    <div className="mt-6 rounded-3xl border border-border bg-card/60 p-4">
      <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Pairs beautifully with</p>
      <div className="mt-3 space-y-3">
        {picks.map((p) => (
          <div key={p.slug} className="flex items-center gap-3">
            <img src={p.images[0]} alt="" className="h-12 w-12 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base leading-tight">{p.name}</p>
              <p className="text-xs text-muted-foreground">{formatINR(p.price)}</p>
            </div>
            <button type="button" onClick={() => add(p.slug)} className="rounded-full border border-primary px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] text-accent transition-colors hover:bg-primary hover:text-primary-foreground">Add</button>
          </div>
        ))}
      </div>
    </div>
  );
}
