-- Customer phone on profile (default delivery address already lives in profiles.shipping_address)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_format;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_phone_format CHECK (phone = '' OR phone ~ '^[6-9][0-9]{9}$');

-- Store-wide marketing settings: one row, publicly readable, written only by the backend after an admin check
CREATE TABLE IF NOT EXISTS public.store_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  announcement_enabled boolean NOT NULL DEFAULT true,
  announcement_text text NOT NULL DEFAULT 'Free delivery across India · Cash on Delivery available' CHECK (char_length(announcement_text) <= 200),
  announcement_link text NOT NULL DEFAULT '' CHECK (char_length(announcement_link) <= 300),
  promo_enabled boolean NOT NULL DEFAULT false,
  promo_text text NOT NULL DEFAULT '' CHECK (char_length(promo_text) <= 200),
  promo_code text NOT NULL DEFAULT '' CHECK (char_length(promo_code) <= 40),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.store_settings TO anon, authenticated;
GRANT ALL ON public.store_settings TO service_role;

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read store settings" ON public.store_settings;
CREATE POLICY "Anyone can read store settings" ON public.store_settings FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Grant the store administrator role automatically, only to the designated email and only once it is verified
CREATE OR REPLACE FUNCTION public.grant_belvish_admin_on_verify()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF new.email_confirmed_at IS NOT NULL AND lower(new.email) = 'zacian061@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.grant_belvish_admin_on_verify() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS belvish_admin_on_create ON auth.users;
CREATE TRIGGER belvish_admin_on_create
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.grant_belvish_admin_on_verify();

DROP TRIGGER IF EXISTS belvish_admin_on_confirm ON auth.users;
CREATE TRIGGER belvish_admin_on_confirm
AFTER UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW
WHEN (old.email_confirmed_at IS NULL AND new.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_belvish_admin_on_verify();

-- If the designated account already exists and is verified, grant now
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE lower(email) = 'zacian061@gmail.com' AND email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;