import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type StoreSettings = {
  announcement_enabled: boolean;
  announcement_text: string;
  announcement_link: string;
  promo_enabled: boolean;
  promo_text: string;
  promo_code: string;
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  announcement_enabled: true,
  announcement_text: "Free delivery across India · Cash on Delivery available",
  announcement_link: "",
  promo_enabled: false,
  promo_text: "",
  promo_code: "",
};

/** Public read of the announcement bar + promo banner. Never throws: falls back to defaults. */
export const getStoreSettings = createServerFn({ method: "GET" }).handler(async (): Promise<StoreSettings> => {
  try {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    const url = process.env["SUPABASE_URL"];
    if (!key || !url) return DEFAULT_STORE_SETTINGS;
    const supabase = createClient<Database>(url, key, {
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
    const { data, error } = await supabase
      .from("store_settings")
      .select("announcement_enabled, announcement_text, announcement_link, promo_enabled, promo_text, promo_code")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return DEFAULT_STORE_SETTINGS;
    return data;
  } catch {
    return DEFAULT_STORE_SETTINGS;
  }
});

/** Only same-site paths or https links are allowed for the announcement link. */
export function safeAnnouncementHref(link: string): string | null {
  const v = link.trim();
  if (!v) return null;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  if (/^https:\/\/[^\s]+$/i.test(v)) return v;
  return null;
}
