-- Every returned value must be true; run with account-security.py.
SELECT
 EXISTS (SELECT FROM pg_class WHERE oid = 'public.profiles'::regclass AND relrowsecurity) AS profiles_enforce_rls,
 NOT has_table_privilege('anon', 'public.profiles', 'SELECT') AS anonymous_cannot_read_profiles,
 NOT (has_table_privilege('authenticated', 'public.user_roles', 'INSERT') OR has_table_privilege('authenticated', 'public.user_roles', 'UPDATE')) AS customers_cannot_grant_roles,
 NOT (has_function_privilege('authenticated', 'public.assign_verified_belvish_admin()', 'EXECUTE') OR has_function_privilege('anon', 'public.assign_verified_belvish_admin()', 'EXECUTE')) AS admin_assignment_backend_only,
 EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'SELECT' AND qual = '(auth.uid() = id)') AS customer_reads_own_profile_only,
 position('zacian061@gmail.com' in pg_get_functiondef('public.assign_verified_belvish_admin()'::regprocedure)) > 0 AS designated_admin_email,
 position('email_confirmed_at IS NOT NULL' in pg_get_functiondef('public.assign_verified_belvish_admin()'::regprocedure)) > 0 AS admin_requires_verified_email,
 NOT (has_table_privilege('anon', 'public.store_settings', 'UPDATE') OR has_table_privilege('authenticated', 'public.store_settings', 'UPDATE') OR has_table_privilege('authenticated', 'public.store_settings', 'INSERT')) AS store_settings_backend_write_only,
 NOT (has_table_privilege('anon', 'public.orders', 'SELECT') OR has_table_privilege('anon', 'public.newsletter_subscribers', 'SELECT') OR has_table_privilege('authenticated', 'public.newsletter_subscribers', 'SELECT')) AS public_cannot_read_orders_or_subscribers,
 NOT has_table_privilege('authenticated', 'public.orders', 'UPDATE') AS customers_cannot_change_order_status,
 position('zacian061@gmail.com' in pg_get_functiondef('public.grant_belvish_admin_on_verify()'::regprocedure)) > 0 AND position('email_confirmed_at IS NOT NULL' in pg_get_functiondef('public.grant_belvish_admin_on_verify()'::regprocedure)) > 0 AS auto_admin_only_for_verified_designated_email;
