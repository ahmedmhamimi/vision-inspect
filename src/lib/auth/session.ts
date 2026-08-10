/**
 * session.ts
 * Server-only helpers for reading "who is signed in" and "are they an admin", built on
 * top of supabase-server.ts. This is the single place route handlers and Server
 * Components go to answer those two questions, so the rule of "admin dashboard requires
 * role = 'admin'" is enforced in one file rather than re-implemented per page.
 *
 * - getCurrentUser(): the signed-in Supabase Auth user, or null.
 * - getCurrentProfile(): the user's row from public.profiles (id, email, role), or null.
 * - requireUser(): redirects to /login if nobody is signed in — for use at the top of
 *   any authenticated Server Component/layout.
 * - requireAdmin(): redirects to /login if signed out, or to /visioninspect if signed in
 *   but not an admin — for use at the top of app/admin/layout.tsx.
 */
import 'server-only';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from './supabase-server';

export interface Profile {
  id: string;
  email: string | null;
  role: 'admin' | 'reviewer';
}

/** Whether Supabase auth env vars are present at all. Mirrors the "fail open" stance
 *  middleware.ts takes: local dev that hasn't set up Supabase yet shouldn't be locked
 *  out of the API routes, since those already gate independently on their own env vars
 *  (GEMINI_API_KEY etc). Used by the API routes' requireApiUser()-style checks. */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Reads the caller's own profile row. RLS on public.profiles only permits selecting
 *  your own row (see migrations/002_add_authentication.sql), so this can never be used
 *  to look up someone else's role — by construction, not just by convention. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data as Profile;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (profile.role !== 'admin') redirect('/visioninspect');
  return profile;
}
