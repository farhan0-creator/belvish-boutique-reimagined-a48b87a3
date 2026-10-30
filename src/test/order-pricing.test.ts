import { describe, expect, it } from "vitest";
import { priceOrder } from "@/lib/order-pricing";

describe("Cash on delivery order pricing", () => {
  it("prices lines from the catalog in INR with free delivery and no COD fee", () => {
    const r = priceOrder([{ slug: "aurum-extrait", qty: 2 }]);
    expect(r.subtotal).toBe(97000);
    expect(r.shipping).toBe(0);
    expect(r.codFee).toBe(0);
    expect(r.total).toBe(97000);
  });

  it("rejects fragrances that are not in the catalog", () => {
    expect(() => priceOrder([{ slug: "fake", qty: 1 }])).toThrow();
  });

  it("rejects an empty bag", () => {
    expect(() => priceOrder([])).toThrow();
  });
});
