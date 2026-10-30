-- This backend grants broad default privileges; keep store settings read-only to the public.
REVOKE ALL ON public.store_settings FROM anon, authenticated;
GRANT SELECT ON public.store_settings TO anon, authenticated;
GRANT ALL ON public.store_settings TO service_role;