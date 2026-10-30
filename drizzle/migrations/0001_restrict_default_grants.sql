-- This backend grants broad default table privileges; narrow them to exactly what the storefront needs (RLS still applies on top).
REVOKE ALL ON public.orders FROM anon, authenticated;
GRANT INSERT ON public.orders TO anon, authenticated;
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

REVOKE ALL ON public.newsletter_subscribers FROM anon, authenticated;
GRANT INSERT ON public.newsletter_subscribers TO anon, authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;

REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

REVOKE ALL ON public.user_roles FROM anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;