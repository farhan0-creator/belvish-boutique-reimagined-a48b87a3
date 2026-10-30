import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { priceOrder, MAX_QTY_PER_ITEM } from "./order-pricing";
import { getAuthenticatedUserId } from "./auth-session";

export const checkoutSchema = z.object({
  customerName: z.string().trim().min(2, "Please enter your full name").max(100),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email").max(255)]),
  addressLine: z.string().trim().min(5, "Please enter your full address").max(300),
  city: z.string().trim().min(2, "Enter your city").max(80),
  state: z.string().trim().min(2, "Choose your state").max(80),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code"),
  notes: z.string().trim().max(500),
});

const inputSchema = checkoutSchema.extend({
  lines: z.array(z.object({ slug: z.string().max(100), qty: z.number().int().min(1).max(MAX_QTY_PER_ITEM) })).min(1).max(30),
});

export type CheckoutInput = z.infer<typeof inputSchema>;

export const placeCodOrder = createServerFn({ method: "POST" })
  .inputValidator((input: CheckoutInput) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    let priced;
    try {
      priced = priceOrder(data.lines);
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }

    const orderNumber = `BLV-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, "0")}`;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    // Attach the order to the logged-in user if they have a valid session.
    const userId = await getAuthenticatedUserId().catch(() => null);

    const { error } = await supabase.from("orders").insert({
      order_number: orderNumber,
      customer_name: data.customerName,
      phone: data.phone,
      email: data.email || null,
      address_line: data.addressLine,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      notes: data.notes || null,
      items: priced.lines,
      subtotal: priced.subtotal,
      shipping: priced.shipping,
      cod_fee: priced.codFee,
      total: priced.total,
      payment_method: "cod",
      status: "placed",
      user_id: userId,
    });

    if (error) {
      console.error("Order insert failed", error);
      return { ok: false as const, error: "We couldn't place your order just now. Please try again." };
    }
    return { ok: true as const, orderNumber, total: priced.total };
  });
