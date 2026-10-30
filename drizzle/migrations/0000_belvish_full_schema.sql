-- BELVISH storefront schema (migrated): orders, newsletter, profiles, roles, order tracking, admin assignment.

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  customer_name text NOT NULL CHECK (char_length(customer_name) BETWEEN 2 AND 100),
  phone text NOT NULL CHECK (phone ~ '^[6-9][0-9]{9}$'),
  email text CHECK (email IS NULL OR char_length(email) <= 255),
  address_line text NOT NULL CHECK (char_length(address_line) BETWEEN 5 AND 300),
  city text NOT NULL CHECK (char_length(city) BETWEEN 2 AND 80),
  state text NOT NULL CHECK (char_length(state) BETWEEN 2 AND 80),
  pincode text NOT NULL CHECK (pincode ~ '^[1-9][0-9]{5}$'),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  items jsonb NOT NULL,
  subtotal integer NOT NULL CHECK (subtotal >= 0),
  shipping integer NOT NULL DEFAULT 0 CHECK (shipping >= 0),
  cod_fee integer NOT NULL DEFAULT 0 CHECK (cod_fee >= 0),
  total integer NOT NULL CHECK (total >= 0),
  payment_method text NOT NULL DEFAULT 'cod' CHECK (payment_method = 'cod'),
  status text NOT NULL DEFAULT 'placed' CHECK (status IN ('placed','confirmed','shipped','delivered','cancelled')),
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.orders TO anon, authenticated;
GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can place a cash on delivery order" ON public.orders;
CREATE POLICY "Anyone can place a cash on delivery order"
ON public.orders FOR INSERT TO anon, authenticated
WITH CHECK (payment_method = 'cod' AND status = 'placed');

DROP POLICY IF EXISTS "Customers read own orders" ON public.orders;
CREATE POLICY "Customers read own orders"
ON public.orders FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (char_length(email) BETWEEN 3 AND 254 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.newsletter_subscribers TO anon, authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can subscribe with a valid email" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can subscribe with a valid email"
ON public.newsletter_subscribers FOR INSERT TO anon, authenticated
WITH CHECK (
  char_length(email) BETWEEN 3 AND 254
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers read own profile" ON public.profiles;
CREATE POLICY "Customers read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "Customers edit own profile" ON public.profiles;
CREATE POLICY "Customers edit own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own roles" ON public.user_roles;
CREATE POLICY "Read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.track_order(_order_number text, _phone text)
RETURNS TABLE (order_number text, status text, total integer, created_at timestamptz, city text, items jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT o.order_number, o.status, o.total, o.created_at, o.city, o.items
  FROM public.orders o
  WHERE o.order_number = upper(trim(_order_number)) AND o.phone = trim(_phone)
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.track_order(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_order(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_customer_profile()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles(id, name) VALUES (new.id, left(coalesce(new.raw_user_meta_data->>'name', ''), 120));
  RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.create_customer_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS belvish_customer_profile ON auth.users;
CREATE TRIGGER belvish_customer_profile
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_customer_profile();

CREATE OR REPLACE FUNCTION public.assign_verified_belvish_admin()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE lower(email) = 'zacian061@gmail.com' AND email_confirmed_at IS NOT NULL;
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Administrator must register and verify email first';
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (admin_id, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.assign_verified_belvish_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_verified_belvish_admin() TO service_role;

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders(created_at DESC);