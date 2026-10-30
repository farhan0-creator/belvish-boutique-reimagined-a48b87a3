import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { getAuthenticatedUserId } from "./auth-session";

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

const ADMIN_EMAIL = "zacian061@gmail.com";

/** Verifies the caller is the designated admin; throws otherwise. */
async function requireAdmin(): Promise<string> {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("Unauthorized");

  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  if (!url || !key) throw new Error("Server configuration error");

  // Verify the user's email matches the designated admin and that they have the admin role.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (!authUser.user || authUser.user.email?.toLowerCase() !== ADMIN_EMAIL) {
    throw new Error("Unauthorized");
  }
  const { data: hasRole } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!hasRole) throw new Error("Unauthorized");
  return userId;
}

function adminClient() {
  // Imported lazily so the service-role client never ships to the browser bundle.
  return import("@/integrations/supabase/client.server").then((m) => m.supabaseAdmin);
}

// ---------------------------------------------------------------------------
// Fetch all orders (newest first)
// ---------------------------------------------------------------------------
export const fetchAllOrders = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("Failed to load orders");
  return data as AdminOrder[];
});

// ---------------------------------------------------------------------------
// Fetch all customers with aggregated order stats
// ---------------------------------------------------------------------------
export const fetchAllCustomers = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const supabase = await adminClient();

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });
  if (profileError) throw new Error("Failed to load profiles");

  // Pull emails from auth.users via admin API.
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) throw new Error("Failed to load user accounts");
  const emailMap = new Map<string, string>();
  for (const u of usersData.users) {
    if (u.email) emailMap.set(u.id, u.email);
  }

  // Aggregate order stats per user.
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

  const customers: AdminCustomer[] = (profiles ?? []).map((p) => ({
    id: p.id,
    email: emailMap.get(p.id) ?? "—",
    name: p.name || "—",
    created_at: p.created_at,
    order_count: stats.get(p.id)?.count ?? 0,
    total_spent: stats.get(p.id)?.spent ?? 0,
    last_order_at: stats.get(p.id)?.last ?? null,
  }));

  return customers;
});

// ---------------------------------------------------------------------------
// Fetch dashboard summary stats
// ---------------------------------------------------------------------------
export type DashboardStats = {
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  pendingOrders: number;
  recentOrders: AdminOrder[];
};

export const fetchDashboardStats = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const supabase = await adminClient();

  const { count: totalOrders, error: e1 } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true });
  if (e1) throw new Error("Failed to count orders");

  const { data: revenueRows, error: e2 } = await supabase
    .from("orders")
    .select("total")
    .neq("status", "cancelled");
  if (e2) throw new Error("Failed to compute revenue");
  const totalRevenue = (revenueRows ?? []).reduce((s, r) => s + r.total, 0);

  const { count: totalCustomers, error: e3 } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });
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

// ---------------------------------------------------------------------------
// Update an order's status (admin only)
// ---------------------------------------------------------------------------
const statusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["placed", "confirmed", "shipped", "delivered", "cancelled"]),
});

export type StatusUpdateInput = z.infer<typeof statusSchema>;

export const updateOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((input: StatusUpdateInput) => statusSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const supabase = await adminClient();
    const { error } = await supabase
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.orderId);
    if (error) throw new Error("Failed to update order status");
    return { ok: true as const };
  });
