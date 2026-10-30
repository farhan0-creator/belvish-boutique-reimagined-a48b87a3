import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/catalog";
import { INDIAN_STATES, profileSchema, readAddress, type ProfileForm } from "@/lib/profile";
import { OrderProgress, readItems } from "@/components/OrderProgress";

const emptyProfile: ProfileForm = { name: "", phone: "", line: "", city: "", state: "", pincode: "" };

export function ProfileCard({ userId, email }: { userId: string; email: string | undefined }) {
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("name, phone, shipping_address").eq("id", userId).single();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState<ProfileForm>(emptyProfile);
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileForm, string>>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile.data) return;
    const a = readAddress(profile.data.shipping_address);
    setForm({ name: profile.data.name, phone: profile.data.phone, line: a.line, city: a.city, state: a.state, pincode: a.pincode });
  }, [profile.data]);

  const set = (k: keyof ProfileForm) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Partial<Record<keyof ProfileForm, string>> = {};
      for (const issue of parsed.error.issues) errs[issue.path[0] as keyof ProfileForm] ??= issue.message;
      setErrors(errs);
      return;
    }
    setBusy(true);
    const { name, phone, line, city, state, pincode } = parsed.data;
    const { error } = await supabase.from("profiles").update({ name, phone, shipping_address: { line, city, state, pincode } }).eq("id", userId);
    setBusy(false);
    if (error) { toast.error("Couldn't save your details. Please try again."); return; }
    toast.success("Your details are saved.");
    void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
  }

  const field = (k: keyof ProfileForm, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <input value={form[k]} onChange={set(k)} className="field-lux mt-2" aria-invalid={!!errors[k]} {...props} />
      {errors[k] && <span className="mt-1 block text-xs text-destructive">{errors[k]}</span>}
    </label>
  );

  return (
    <section className="rounded-[2rem] border border-border bg-card p-8">
      <h2 className="font-display text-3xl">Your details</h2>
      <p className="mt-1 break-all text-sm text-muted-foreground">{email}</p>
      {profile.isError ? (
        <p role="alert" className="mt-6 text-sm text-destructive">Your profile could not be loaded. Please refresh and try again.</p>
      ) : (
        <form onSubmit={save} noValidate className="mt-8 grid gap-5 sm:grid-cols-2">
          {field("name", "Full name", { autoComplete: "name", maxLength: 100 })}
          {field("phone", "Mobile number", { autoComplete: "tel-national", inputMode: "numeric", maxLength: 10, placeholder: "10-digit number" })}
          <div className="sm:col-span-2">{field("line", "Default delivery address", { autoComplete: "street-address", maxLength: 300, placeholder: "House, street, area" })}</div>
          {field("city", "City", { autoComplete: "address-level2", maxLength: 80 })}
          <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">State</span>
            <select value={form.state} onChange={set("state")} className="field-lux mt-2">
              <option value="">Select state</option>
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          {field("pincode", "PIN code", { autoComplete: "postal-code", inputMode: "numeric", maxLength: 6 })}
          <div className="flex items-end">
            <button type="submit" disabled={busy || profile.isPending} className="btn-gold w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save details"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export function MyOrders({ userId }: { userId: string }) {
  const orders = useQuery({
    queryKey: ["my-orders", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, created_at, items, total, status, address_line, city, state, pincode")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });

  return (
    <section>
      <h2 className="font-display text-3xl">My orders</h2>
      {orders.isPending ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading your orders…</p>
      ) : orders.isError ? (
        <p role="alert" className="mt-6 text-sm text-destructive">Your orders could not be loaded. Please refresh and try again.</p>
      ) : orders.data.length === 0 ? (
        <div className="mt-6 rounded-[2rem] border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No orders yet. Orders you place while signed in will appear here with live status.</p>
          <Link to="/shop" className="btn-ghost-gold mt-6">Explore the edit</Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-6">
          {orders.data.map((o) => (
            <li key={o.id} className="rounded-[2rem] border border-border bg-card p-8">
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Order</p>
                  <p className="font-display text-2xl">{o.order_number}</p>
                  <p className="text-sm text-muted-foreground">Placed {new Date(o.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Pay on delivery</p>
                  <p className="font-display text-2xl text-gold-gradient">{formatINR(o.total)}</p>
                </div>
              </div>
              <div className="mt-8"><OrderProgress status={o.status} /></div>
              <div className="mt-8 grid gap-6 border-t border-border pt-6 text-sm sm:grid-cols-2">
                <ul className="space-y-1 text-muted-foreground">
                  {readItems(o.items).map((i, idx) => <li key={`${i.name}-${idx}`}>{i.qty} × {i.name}</li>)}
                </ul>
                <p className="text-muted-foreground sm:text-right">{o.address_line}, {o.city}, {o.state} {o.pincode}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
