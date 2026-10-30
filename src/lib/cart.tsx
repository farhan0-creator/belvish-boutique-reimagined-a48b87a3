import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { products, type Product } from "./catalog";

type Line = { slug: string; qty: number };
type Ctx = {
  lines: (Line & { product: Product })[];
  count: number;
  total: number;
  open: boolean;
  setOpen: (o: boolean) => void;
  add: (slug: string, qty?: number) => void;
  setQty: (slug: string, qty: number) => void;
  clear: () => void;
};

const CartCtx = createContext<Ctx | null>(null);
const KEY = "belvish-bag";

export function CartProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<Line[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { setRaw(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { /* ignore */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(raw)); }, [raw, ready]);

  const lines = raw
    .map((l) => ({ ...l, product: products.find((p) => p.slug === l.slug)! }))
    .filter((l) => l.product);

  const value: Ctx = {
    lines,
    count: lines.reduce((s, l) => s + l.qty, 0),
    total: lines.reduce((s, l) => s + l.qty * l.product.price, 0),
    open, setOpen,
    add: (slug, qty = 1) => {
      setRaw((r) => r.some((l) => l.slug === slug)
        ? r.map((l) => (l.slug === slug ? { ...l, qty: Math.min(l.qty + qty, 10) } : l))
        : [...r, { slug, qty }]);
      setOpen(true);
    },
    setQty: (slug, qty) =>
      setRaw((r) => (qty <= 0 ? r.filter((l) => l.slug !== slug) : r.map((l) => (l.slug === slug ? { ...l, qty: Math.min(qty, 10) } : l)))),
    clear: () => setRaw([]),
  };
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}
