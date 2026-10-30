import { products } from "./catalog";

export const MAX_QTY_PER_ITEM = 10;
/** Delivery is free across India; Cash on Delivery carries no extra fee. */
export const SHIPPING_FEE = 0;
export const COD_FEE = 0;

export type OrderLineInput = { slug: string; qty: number };
export type PricedLine = { slug: string; name: string; qty: number; unitPrice: number; lineTotal: number };

/** Prices every line from the catalog so totals never trust the browser. */
export function priceOrder(lines: OrderLineInput[]) {
  if (lines.length === 0) throw new Error("Your bag is empty.");
  const priced: PricedLine[] = lines.map((l) => {
    const p = products.find((x) => x.slug === l.slug);
    if (!p) throw new Error("One of the fragrances in your bag is no longer available.");
    if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_QTY_PER_ITEM) {
      throw new Error(`Quantity must be between 1 and ${MAX_QTY_PER_ITEM}.`);
    }
    return { slug: p.slug, name: p.name, qty: l.qty, unitPrice: p.price, lineTotal: p.price * l.qty };
  });
  const subtotal = priced.reduce((s, l) => s + l.lineTotal, 0);
  return { lines: priced, subtotal, shipping: SHIPPING_FEE, codFee: COD_FEE, total: subtotal + SHIPPING_FEE + COD_FEE };
}
