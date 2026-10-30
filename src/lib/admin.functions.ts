import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin order row — everything the dashboard needs in one payload. */
export type AdminOrder = Database["public"]["Tables"]["orders"]["Row"];
export type AdminCustomer = {
  id: string;
  email: string;
  name: string;
  created_at: string;
  order_count: number;
  total_spent: number;
  last_order_at: string | null;
};
export type NewsletterSubscriber = { id: string; email: string; created_at: string };

export const ADMIN_EMAIL = "zacian061@gmail.com";
export const ORDER_STATUSES = ["placed", "confirmed", "shipped", "delivered", "cancelled"] as const;

type AuthedContext = {
  supabase: import("@supabase/supabase-js").SupabaseClient<Database>;
  userId: string;
  claims: { email?: unknown };
};

/**
 * Verifies the caller is the designated store administrator: verified session,
 * the designated email, and the admin role record. Throws otherwise.
 */
async function requireAdmin(context: AuthedContext) {
  const email = typeof context.claims.email === "string" ? context.claims.email.toLowerCase() : "";
  if (email !== ADMIN_EMAIL) throw new Error("Unauthorized");
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !isAdmin) throw new Error("Unauthorized");
  // Imported lazily so the service-role client never ships to the browser bundle.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const fetchAllOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = await requireAdmin(context);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error("Failed to load orders");
    return data as AdminOrder[];
  });

export const fetchAllCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = await requireAdmin(context);
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, created_at")
      .order("created_at", { ascending: false });
    if (profileError) throw new Error("Failed to load profiles");

    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw new Error("Failed to load user accounts");
    const emailMap = new Map<string, string>();
    for (const u of usersData.users) if (u.email) emailMap.set(u.id, u.email);

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("user_id, total, created_at")
      .not("user_id", "is", null);
    if (ordersError) throw new Error("Failed to load order stats");

    const stats = new Map<string, { count: number; spent: number; last: string | null }>();
    for (const o of orders) {
      if (!o.user_id) continue;
      const s = stats.get(o.user_id) ?? { count: 0, spent: 0, last: null };
      s.count += 1;
      s.spent += o.total;
      if (!s.last || o.created_at > s.last) s.last = o.created_at;
      stats.set(o.user_id, s);
    }

    return (profiles ?? []).map((p) => ({
      id: p.id,
      email: emailMap.get(p.id) ?? "—",
      name: p.name || "—",
      created_at: p.created_at,
      order_count: stats.get(p.id)?.count ?? 0,
      total_spent: stats.get(p.id)?.spent ?? 0,
      last_order_at: stats.get(p.id)?.last ?? null,
    })) satisfies AdminCustomer[];
  });

export type DashboardStats = {
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  pendingOrders: number;
  recentOrders: AdminOrder[];
};

export const fetchDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = await requireAdmin(context);

    const { count: totalOrders, error: e1 } = await supabase.from("orders").select("*", { count: "exact", head: true });
    if (e1) throw new Error("Failed to count orders");

    const { data: revenueRows, error: e2 } = await supabase.from("orders").select("total").neq("status", "cancelled");
    if (e2) throw new Error("Failed to compute revenue");
    const totalRevenue = (revenueRows ?? []).reduce((s, r) => s + r.total, 0);

    const { count: totalCustomers, error: e3 } = await supabase.from("profiles").select("*", { count: "exact", head: true });
    if (e3) throw new Error("Failed to count customers");

    const { count: pendingOrders, error: e4 } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["placed", "confirmed"]);
    if (e4) throw new Error("Failed to count pending orders");

    const { data: recentOrders, error: e5 } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8);
    if (e5) throw new Error("Failed to load recent orders");

    return {
      totalOrders: totalOrders ?? 0,
      totalRevenue,
      totalCustomers: totalCustomers ?? 0,
      pendingOrders: pendingOrders ?? 0,
      recentOrders: (recentOrders ?? []) as AdminOrder[],
    } satisfies DashboardStats;
  });

const statusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(ORDER_STATUSES),
});
export type StatusUpdateInput = z.infer<typeof statusSchema>;

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: StatusUpdateInput) => statusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await requireAdmin(context);
    const { error } = await supabase.from("orders").update({ status: data.status }).eq("id", data.orderId);
    if (error) throw new Error("Failed to update order status");
    return { ok: true as const };
  });

export const fetchNewsletterSubscribers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = await requireAdmin(context);
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .select("id, email, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error("Failed to load subscribers");
    return (data ?? []) as NewsletterSubscriber[];
  });

const linkSchema = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\/\S+$/i.test(v), "Use a page path like /shop or a full https:// link");

export const storeSettingsSchema = z.object({
  announcement_enabled: z.boolean(),
  announcement_text: z.string().trim().max(200, "Keep it under 200 characters"),
  announcement_link: linkSchema,
  promo_enabled: z.boolean(),
  promo_text: z.string().trim().max(200, "Keep it under 200 characters"),
  promo_code: z.string().trim().max(40, "Keep it under 40 characters"),
});
export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;

export const updateStoreSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: StoreSettingsInput) => storeSettingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = await requireAdmin(context);
    const { error } = await supabase
      .from("store_settings")
      .upsert({ id: 1, ...data, updated_at: new Date().toISOString() });
    if (error) throw new Error("Failed to save settings");
    return { ok: true as const };
  });
