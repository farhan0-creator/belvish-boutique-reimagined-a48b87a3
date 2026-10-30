import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { accountHead, useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/auth')({
  validateSearch: (search: Record<string, unknown>) => ({ signup: search['signup'] === true || search['signup'] === 'true' }),
  head: () => accountHead('Your account', 'Sign in or create your BELVISH customer account.'),
  component: AuthPage,
});

function AuthPage() {
  const { signup } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [forgot, setForgot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    try {
      if (forgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMessage('If an account exists, a password reset link will arrive by email.');
      } else if (signup) {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { name: String(form.get('name') ?? '').trim() }, emailRedirectTo: window.location.origin } });
        if (error) throw error;
        setMessage('Check your email to confirm your account before signing in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await navigate({ to: '/account' });
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  if (user && !forgot) return <main className="mx-auto max-w-md px-6 py-20"><h1 className="font-display text-4xl">Your account</h1><Button asChild className="mt-6"><Link to="/account">Open account</Link></Button></main>;
  return <main className="mx-auto max-w-md px-6 py-20">
    <h1 className="font-display text-4xl">{forgot ? 'Reset password' : signup ? 'Create your account' : 'Welcome back'}</h1>
    <form onSubmit={submit} className="mt-8 space-y-5">
      {signup && !forgot && <label className="block text-sm">Name<input name="name" required maxLength={120} autoComplete="name" className="mt-2 w-full rounded-md border border-input bg-background p-3" /></label>}
      <label className="block text-sm">Email<input name="email" type="email" required autoComplete="email" className="mt-2 w-full rounded-md border border-input bg-background p-3" /></label>
      {!forgot && <label className="block text-sm">Password<input name="password" type="password" required minLength={8} autoComplete={signup ? 'new-password' : 'current-password'} className="mt-2 w-full rounded-md border border-input bg-background p-3" /></label>}
      <Button type="submit" disabled={busy} className="w-full">{busy ? 'Please wait…' : forgot ? 'Send reset link' : signup ? 'Sign up' : 'Login'}</Button>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </form>
    <div className="mt-5 flex flex-wrap gap-3">
      <Button variant="link" asChild><Link to="/auth" search={{ signup: !signup }} onClick={() => { setForgot(false); setMessage(''); }}>{signup ? 'Login' : 'Sign up'}</Link></Button>
      <Button variant="link" onClick={() => { setForgot(!forgot); setMessage(''); }}>{forgot ? 'Back to login' : 'Forgot password?'}</Button>
    </div>
  </main>;
}