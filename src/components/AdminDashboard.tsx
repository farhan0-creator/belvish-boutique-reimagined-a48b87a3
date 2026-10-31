import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, ImagePlus, Loader2 } from "lucide-react";
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
import { PopupCard } from "@/components/PopupAd";
import { supabase } from "@/integrations/supabase/client";
import { POPUP_BUCKET } from "@/lib/store-settings.functions";
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

type TextKey = "announcement_text" | "announcement_link" | "promo_text" | "promo_code" | "popup_title" | "popup_text" | "popup_image_url" | "popup_button_text" | "popup_button_link";

function MarketingManager() {
  const current = useStoreSettings();
  const router = useRouter();
  const save = useServerFn(updateStoreSettings);
  const [form, setForm] = useState<StoreSettingsInput>(current);
  const [errors, setErrors] = useState<Partial<Record<keyof StoreSettingsInput, string>>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localImage, setLocalImage] = useState("");
  const [preview, setPreview] = useState(false);
  useEffect(() => { setForm(current); setLocalImage(""); }, [current]);

  const text = (k: TextKey) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const imageSrc = localImage
    || (form.popup_image_url === current.popup_image_url ? current.popup_image_src : "")
    || (/^https:\/\/\S+$/i.test(form.popup_image_url) ? form.popup_image_url : "");

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { toast.error("Please choose a JPG, PNG, WebP or GIF image."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Please choose an image under 5 MB."); return; }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(POPUP_BUCKET).upload(name, file, { contentType: file.type });
    setUploading(false);
    if (error) { toast.error("Couldn't upload the image. Please try again."); return; }
    setLocalImage(URL.createObjectURL(file));
    setForm((f) => ({ ...f, popup_image_url: `${POPUP_BUCKET}/${name}` }));
    setErrors((er) => ({ ...er, popup_image_url: undefined }));
    toast.success("Image uploaded. Save changes to publish it.");
  }

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
      toast.success("Marketing settings saved.");
      await router.invalidate();
    } catch {
      toast.error("Couldn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const label = "text-xs uppercase tracking-[0.2em] text-muted-foreground";
  const err = (k: keyof StoreSettingsInput) => errors[k] && <span className="mt-1 block text-xs text-destructive">{errors[k]}</span>;
  const input = (k: TextKey, title: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className={label}>{title}</span>
      <input value={form[k]} onChange={text(k)} className="field-lux mt-2" aria-invalid={!!errors[k]} {...props} />
      {err(k)}
    </label>
  );
  const toggle = (k: "announcement_enabled" | "promo_enabled" | "popup_enabled", aria: string) => (
    <label className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
      {form[k] ? "On" : "Off"}
      <Switch checked={form[k]} onCheckedChange={(v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((er) => ({ ...er, popup_title: undefined })); }} aria-label={aria} />
    </label>
  );

  return (
    <section className={card}>
      <h2 className="font-display text-3xl">Marketing &amp; announcements</h2>
      <form onSubmit={submit} noValidate className="mt-8 space-y-10">
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm uppercase tracking-[0.2em] text-accent">Announcement bar</p>
            {toggle("announcement_enabled", "Show announcement bar")}
          </div>
          {input("announcement_text", "Message", { maxLength: 200 })}
          {input("announcement_link", "Link (optional)", { maxLength: 300, placeholder: "/shop or https://…" })}
        </div>
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm uppercase tracking-[0.2em] text-accent">Promotional banner</p>
            {toggle("promo_enabled", "Show promotional banner")}
          </div>
          {input("promo_text", "Banner text", { maxLength: 200, placeholder: "Festive edit — 10% off every extrait" })}
          {input("promo_code", "Coupon code (optional)", { maxLength: 40, placeholder: "FESTIVE10" })}
          <p className="text-xs text-muted-foreground">The banner appears on the home page and The Edit.</p>
        </div>
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm uppercase tracking-[0.2em] text-accent">Pop-up ad</p>
            {toggle("popup_enabled", "Show pop-up ad")}
          </div>
          {input("popup_title", "Headline", { maxLength: 80, placeholder: "The Diwali edit has arrived" })}
          <label className="block">
            <span className={label}>Message (optional)</span>
            <textarea value={form.popup_text} onChange={text("popup_text")} maxLength={300} rows={3} className="field-lux mt-2" placeholder="Complimentary gift wrap and a hand-written note on every order this week." aria-invalid={!!errors.popup_text} />
            {err("popup_text")}
          </label>
          <div>
            <span className={label}>Image (optional)</span>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              {imageSrc && <img src={imageSrc} alt="Pop-up image preview" className="h-20 w-20 rounded-2xl object-cover" />}
              <label className="btn-ghost-gold cursor-pointer !px-5 !py-2 text-xs">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} {form.popup_image_url ? "Replace image" : "Upload image"}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={uploading} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              {form.popup_image_url && (
                <button type="button" onClick={() => { setForm((f) => ({ ...f, popup_image_url: "" })); setLocalImage(""); }} className="text-xs uppercase tracking-[0.2em] text-muted-foreground underline underline-offset-4 hover:text-destructive">Remove</button>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">JPG, PNG, WebP or GIF, up to 5 MB. Wide images look best.</p>
            {err("popup_image_url")}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {input("popup_button_text", "Button text (optional)", { maxLength: 30, placeholder: "Shop the edit" })}
            {input("popup_button_link", "Button link", { maxLength: 300, placeholder: "/shop or https://…" })}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className={label}>Show after (seconds)</span>
              <input type="number" min={0} max={60} step={1} value={form.popup_delay_seconds} onChange={(e) => setForm((f) => ({ ...f, popup_delay_seconds: e.target.value === "" ? 0 : Number(e.target.value) }))} className="field-lux mt-2" aria-invalid={!!errors.popup_delay_seconds} />
              {err("popup_delay_seconds")}
            </label>
            <label className="block">
              <span className={label}>How often</span>
              <select value={form.popup_frequency} onChange={(e) => setForm((f) => ({ ...f, popup_frequency: e.target.value as "once" | "visit" }))} className="field-lux mt-2">
                <option value="once">Once per visitor</option>
                <option value="visit">Once every visit</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Shows on every page except checkout and sign-in. Editing the ad shows it again to everyone.</p>
            <button type="button" onClick={() => setPreview(true)} disabled={!form.popup_title && !form.popup_text && !imageSrc} className="btn-ghost-gold !px-5 !py-2 text-xs"><Eye className="h-4 w-4" /> Preview</button>
          </div>
          <PopupCard
            open={preview}
            onOpenChange={setPreview}
            content={{ title: form.popup_title, text: form.popup_text, imageSrc, buttonText: form.popup_button_text, buttonLink: form.popup_button_link }}
          />
        </div>
        <button type="submit" disabled={busy || uploading} className="btn-gold w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}</button>
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
