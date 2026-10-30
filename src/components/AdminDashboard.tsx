import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { formatINR } from "@/lib/catalog";
import {
  ORDER_STATUSES,
  fetchAllOrders,
  fetchDashboardStats,
  fetchNewsletterSubscribers,
  storeSettingsSchema,
  updateOrderStatus,
  updateStoreSettings,
  type StoreSettingsInput,
} from "@/lib/admin.functions";
import { useStoreSettings } from "@/components/Shell";
import { STATUS_LABEL, readItems } from "@/components/OrderProgress";

const card = "rounded-[2rem] border border-border bg-card p-8";
const fmtDate = (d: string) => new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function AdminDashboard() {
  return (
    <div className="space-y-12">
      <Metrics />
      <OrdersTable />
      <div className="grid gap-8 lg:grid-cols-2">
        <MarketingManager />
        <Subscribers />
      </div>
    </div>
  );
}

function Metrics() {
  const getStats = useServerFn(fetchDashboardStats);
  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: () => getStats() });
  const items = [
    { label: "Total orders", value: stats.data ? String(stats.data.totalOrders) : "—" },
    { label: "Total revenue", value: stats.data ? formatINR(stats.data.totalRevenue) : "—" },
    { label: "Pending orders", value: stats.data ? String(stats.data.pendingOrders) : "—" },
    { label: "Total customers", value: stats.data ? String(stats.data.totalCustomers) : "—" },
  ];
  return (
    <section>
      <h2 className="font-display text-3xl">Store at a glance</h2>
      {stats.isError && <p role="alert" className="mt-4 text-sm text-destructive">Store figures could not be loaded.</p>}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {items.map((m) => (
          <div key={m.label} className="rounded-3xl border border-border bg-card px-6 py-6">
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{m.label}</p>
            <p className="mt-2 font-display text-3xl text-gold-gradient">{stats.isPending ? "…" : m.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Revenue excludes cancelled orders. Pending means placed or confirmed.</p>
    </section>
  );
}

function OrdersTable() {
  const queryClient = useQueryClient();
  const getOrders = useServerFn(fetchAllOrders);
  const setStatus = useServerFn(updateOrderStatus);
  const orders = useQuery({ queryKey: ["admin", "orders"], queryFn: () => getOrders() });
  const [saving, setSaving] = useState<string | null>(null);

  async function change(orderId: string, status: (typeof ORDER_STATUSES)[number]) {
    setSaving(orderId);
    try {
      await setStatus({ data: { orderId, status } });
      toast.success(`Order marked ${(STATUS_LABEL[status] ?? status).toLowerCase()}.`);
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    } catch {
      toast.error("Couldn't update the order. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section>
      <h2 className="font-display text-3xl">All orders</h2>
      <div className={`mt-6 overflow-x-auto ${card} !p-0`}>
        {orders.isPending ? (
          <p className="p-8 text-sm text-muted-foreground">Loading orders…</p>
        ) : orders.isError ? (
          <p role="alert" className="p-8 text-sm text-destructive">Orders could not be loaded.</p>
        ) : orders.data.length === 0 ? (
          <p className="p-8 text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-border text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-normal">Order</th>
                <th className="px-6 py-4 font-normal">Customer</th>
                <th className="px-6 py-4 font-normal">Delivery address</th>
                <th className="px-6 py-4 font-normal">Items</th>
                <th className="px-6 py-4 font-normal">Total</th>
                <th className="px-6 py-4 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border align-top">
              {orders.data.map((o) => (
                <tr key={o.id}>
                  <td className="px-6 py-4">
                    <p className="font-display text-lg">{o.order_number}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p>{o.customer_name}</p>
                    <a href={`tel:${o.phone}`} className="text-xs text-muted-foreground hover:text-accent">{o.phone}</a>
                    {o.email && <p className="break-all text-xs text-muted-foreground">{o.email}</p>}
                  </td>
                  <td className="max-w-[240px] px-6 py-4 text-muted-foreground">
                    {o.address_line}, {o.city}, {o.state} {o.pincode}
                    {o.notes && <p className="mt-1 text-xs italic">“{o.notes}”</p>}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {readItems(o.items).map((i, idx) => <p key={`${i.name}-${idx}`}>{i.qty} × {i.name}</p>)}
                  </td>
                  <td className="px-6 py-4 font-display text-lg">{formatINR(o.total)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <select
                        value={o.status}
                        disabled={saving === o.id}
                        onChange={(e) => void change(o.id, e.target.value as (typeof ORDER_STATUSES)[number])}
                        aria-label={`Status for ${o.order_number}`}
                        className="field-lux !py-2 text-xs"
                      >
                        {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                      {saving === o.id && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function MarketingManager() {
  const current = useStoreSettings();
  const router = useRouter();
  const save = useServerFn(updateStoreSettings);
  const [form, setForm] = useState<StoreSettingsInput>(current);
  const [errors, setErrors] = useState<Partial<Record<keyof StoreSettingsInput, string>>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForm(current); }, [current]);

  const text = (k: "announcement_text" | "announcement_link" | "promo_text" | "promo_code") => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = storeSettingsSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Partial<Record<keyof StoreSettingsInput, string>> = {};
      for (const issue of parsed.error.issues) errs[issue.path[0] as keyof StoreSettingsInput] ??= issue.message;
      setErrors(errs);
      return;
    }
    setBusy(true);
    try {
      await save({ data: parsed.data });
      toast.success("Announcement and promo saved.");
      await router.invalidate();
    } catch {
      toast.error("Couldn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const input = (k: "announcement_text" | "announcement_link" | "promo_text" | "promo_code", label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <input value={form[k]} onChange={text(k)} className="field-lux mt-2" aria-invalid={!!errors[k]} {...props} />
      {errors[k] && <span className="mt-1 block text-xs text-destructive">{errors[k]}</span>}
    </label>
  );

  return (
    <section className={card}>
      <h2 className="font-display text-3xl">Marketing &amp; announcements</h2>
      <form onSubmit={submit} noValidate className="mt-8 space-y-10">
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm uppercase tracking-[0.2em] text-accent">Announcement bar</p>
            <label className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {form.announcement_enabled ? "On" : "Off"}
              <Switch checked={form.announcement_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, announcement_enabled: v }))} aria-label="Show announcement bar" />
            </label>
          </div>
          {input("announcement_text", "Message", { maxLength: 200 })}
          {input("announcement_link", "Link (optional)", { maxLength: 300, placeholder: "/shop or https://…" })}
        </div>
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm uppercase tracking-[0.2em] text-accent">Promotional banner</p>
            <label className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {form.promo_enabled ? "On" : "Off"}
              <Switch checked={form.promo_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, promo_enabled: v }))} aria-label="Show promotional banner" />
            </label>
          </div>
          {input("promo_text", "Banner text", { maxLength: 200, placeholder: "Festive edit — 10% off every extrait" })}
          {input("promo_code", "Coupon code (optional)", { maxLength: 40, placeholder: "FESTIVE10" })}
          <p className="text-xs text-muted-foreground">The banner appears on the home page and The Edit.</p>
        </div>
        <button type="submit" disabled={busy} className="btn-gold w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}</button>
      </form>
    </section>
  );
}

function Subscribers() {
  const getSubs = useServerFn(fetchNewsletterSubscribers);
  const subs = useQuery({ queryKey: ["admin", "subscribers"], queryFn: () => getSubs() });
  return (
    <section className={card}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-3xl">Newsletter</h2>
        {subs.data && <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{subs.data.length} subscribers</p>}
      </div>
      {subs.isPending ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading subscribers…</p>
      ) : subs.isError ? (
        <p role="alert" className="mt-6 text-sm text-destructive">Subscribers could not be loaded.</p>
      ) : subs.data.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No subscribers yet.</p>
      ) : (
        <ul className="mt-6 max-h-[520px] divide-y divide-border overflow-y-auto text-sm">
          {subs.data.map((s) => (
            <li key={s.id} className="flex justify-between gap-4 py-3">
              <a href={`mailto:${s.email}`} className="break-all hover:text-accent">{s.email}</a>
              <span className="shrink-0 text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
