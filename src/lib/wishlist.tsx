import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Ctx = { slugs: string[]; has: (slug: string) => boolean; toggle: (slug: string) => void };
const WishCtx = createContext<Ctx | null>(null);
const KEY = "belvish-wishlist";

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { setSlugs(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { /* ignore */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(slugs)); }, [slugs, ready]);
  const value: Ctx = {
    slugs,
    has: (s) => slugs.includes(s),
    toggle: (s) => setSlugs((l) => (l.includes(s) ? l.filter((x) => x !== s) : [...l, s])),
  };
  return <WishCtx.Provider value={value}>{children}</WishCtx.Provider>;
}

export function useWishlist() {
  const c = useContext(WishCtx);
  if (!c) throw new Error("useWishlist outside WishlistProvider");
  return c;
}
