import { useEffect, useState } from "react";
import { products, type Product } from "./catalog";

const KEY = "belvish-recent";
const MAX = 6;

/** Records the current product and returns the other recently viewed ones (browser-only). */
export function useRecentlyViewed(current: string): Product[] {
  const [list, setList] = useState<Product[]>([]);
  useEffect(() => {
    let slugs: string[] = [];
    try { slugs = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { /* ignore */ }
    const others = slugs.filter((s) => s !== current);
    localStorage.setItem(KEY, JSON.stringify([current, ...others].slice(0, MAX)));
    setList(others.map((s) => products.find((p) => p.slug === s)).filter((p): p is Product => !!p).slice(0, 4));
  }, [current]);
  return list;
}

/** Adds working days (Mon–Sat) to a date. */
export function addWorkingDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) left--;
  }
  return d;
}
