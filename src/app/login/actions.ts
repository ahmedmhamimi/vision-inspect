/**
 * actions.ts (/login)
 * Server Action for signing in. Runs entirely server-side, using the same
 * createSupabaseServerClient() as every other server-only Supabase call in this app
 * (see supabase-server.ts) — reads only SUPABASE_URL / SUPABASE_ANON_KEY, never a
 * NEXT_PUBLIC_-prefixed var. This is why the login page can be a plain server-rendered
 * form instead of needing a browser Supabase client: the credentials never need to
 * leave the server to authenticate.
 *
 * - signInAction(formData): validates email/password are present, calls
 *   supabase.auth.signInWithPassword (which sets the session cookie via
 *   createSupabaseServerClient's cookie adapter), then redirects to `next` on success or
 *   back to /login with an error message on failure.
 */
'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/auth/supabase-server';

export async function signInAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/visioninspect');

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent('Email and password are required.')}&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent('Incorrect email or password.')}&next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}
