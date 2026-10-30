import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { accountHead } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export const Route = createFileRoute('/_authenticated/account')({ head: () => accountHead('My account', 'Your private BELVISH customer profile.'), component: Account });
function Account() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const profile = useQuery({ queryKey: ['profile', user.id], queryFn: async () => {
    const { data, error } = await supabase.from('profiles').select('name').eq('id', user.id).single();
    if (error) throw error;
    return data;
  } });
  const role = useQuery({ queryKey: ['role', user.id], queryFn: async () => {
    const { data, error } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (error) throw error;
    return data;
  } });
  async function logout() {
    setBusy(true); setError('');
    await queryClient.cancelQueries(); queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) { setError(error.message); setBusy(false); return; }
    await navigate({ to: '/auth', search: { signup: false }, replace: true });
  }
  return <main className="mx-auto max-w-xl px-6 py-20"><h1 className="font-display text-4xl">My account</h1>
    <dl className="mt-8 space-y-5"><div><dt className="text-sm text-muted-foreground">Name</dt><dd>{profile.isPending ? 'Loading…' : profile.data?.name || '—'}</dd></div><div><dt className="text-sm text-muted-foreground">Email</dt><dd className="break-all">{user.email}</dd></div>{role.data && <div><dt className="text-sm text-muted-foreground">Access</dt><dd>Administrator</dd></div>}</dl>
    {profile.isError && <p role="alert" className="mt-4 text-sm">Your profile could not be loaded. Please try again.</p>}
    {error && <p role="alert" className="mt-4 text-sm">{error}</p>}
    <Button onClick={logout} disabled={busy} className="mt-8">{busy ? 'Please wait…' : 'Logout'}</Button>
  </main>;
}