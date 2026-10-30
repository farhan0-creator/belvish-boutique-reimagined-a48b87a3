import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { accountHead } from '@/lib/auth';
import { Eyebrow } from '@/components/Shell';
import { MyOrders, ProfileCard } from '@/components/CustomerAccount';
import { AdminDashboard } from '@/components/AdminDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ADMIN_EMAIL = 'zacian061@gmail.com';

export const Route = createFileRoute('/_authenticated/account')({
  head: () => accountHead('My account', 'Your BELVISH profile, saved delivery address and order history.'),
  component: Account,
});

function Account() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // UI hint only — every admin action is re-checked on the server.
  const role = useQuery({
    queryKey: ['role', user.id],
    enabled: user.email?.toLowerCase() === ADMIN_EMAIL,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (error) throw error;
      return data;
    },
  });
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL && role.data === true;

  async function logout() {
    setBusy(true); setError('');
    await queryClient.cancelQueries(); queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) { setError(error.message); setBusy(false); return; }
    await navigate({ to: '/auth', search: { signup: false }, replace: true });
  }

  const customer = (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div><ProfileCard userId={user.id} email={user.email} /></div>
      <MyOrders userId={user.id} />
    </div>
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Eyebrow>{isAdmin ? 'Store administrator' : 'Your account'}</Eyebrow>
          <h1 className="mt-4 font-display text-5xl font-light md:text-6xl">My <em>account.</em></h1>
        </div>
        <button onClick={logout} disabled={busy} className="btn-ghost-gold">{busy ? 'Please wait…' : 'Log out'}</button>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-12">
        {isAdmin ? (
          <Tabs defaultValue="store">
            <TabsList className="rounded-full">
              <TabsTrigger value="store" className="rounded-full">Store dashboard</TabsTrigger>
              <TabsTrigger value="me" className="rounded-full">My details &amp; orders</TabsTrigger>
            </TabsList>
            <TabsContent value="store" className="mt-10"><AdminDashboard /></TabsContent>
            <TabsContent value="me" className="mt-10">{customer}</TabsContent>
          </Tabs>
        ) : customer}
      </div>
    </main>
  );
}
