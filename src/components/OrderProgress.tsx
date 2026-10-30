import { Check } from "lucide-react";

export const ORDER_STEPS = ["placed", "confirmed", "shipped", "delivered"] as const;
export const STATUS_LABEL: Record<string, string> = { placed: "Order placed", confirmed: "Confirmed", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" };

export type OrderItem = { slug?: string; name: string; qty: number; lineTotal?: number };
export const readItems = (raw: unknown): OrderItem[] =>
  Array.isArray(raw) ? (raw as OrderItem[]).filter((i) => i && typeof i.name === "string") : [];

/** Live order status as a four-step progress line (or a cancelled notice). */
export function OrderProgress({ status }: { status: string }) {
  if (status === "cancelled") return <p className="text-sm text-destructive">This order was cancelled. Contact us if this is unexpected.</p>;
  const stepIndex = ORDER_STEPS.indexOf(status as (typeof ORDER_STEPS)[number]);
  return (
    <ol className="grid grid-cols-4 gap-2">
      {ORDER_STEPS.map((s, i) => (
        <li key={s} className="text-center">
          <span className={`mx-auto grid h-8 w-8 place-items-center rounded-full border text-xs ${i <= stepIndex ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>
            {i <= stepIndex ? <Check className="h-4 w-4" /> : i + 1}
          </span>
          <p className={`mt-2 text-[10px] uppercase tracking-[0.2em] ${i <= stepIndex ? "text-accent" : "text-muted-foreground"}`}>{STATUS_LABEL[s]}</p>
        </li>
      ))}
    </ol>
  );
}
