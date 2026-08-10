/**
 * actions.ts (/signup)
 * Server Action for self-service sign-up. Mirrors login/actions.ts exactly: runs
 * entirely server-side through the same createSupabaseServerClient() (anon key +
 * request cookies), so no browser Supabase client or NEXT_PUBLIC_-prefixed env var is
 * ever needed here either.
 *
 * - signUpAction(formData): validates the form, calls supabase.auth.signUp(). A
 *   database trigger (see migrations/003_self_service_signup_and_default_admin.sql)
 *   auto-creates the matching public.profiles row — role 'admin' if the email is
 *   exactly the well-known default admin address, 'reviewer' for everyone else. This
 *   action never sets or requests a role itself; there is no form field for it.
 * - If the Supabase project has email confirmations enabled, signUp() succeeds but
 *   returns no session yet (the account exists but is unconfirmed) — that case sends
 *   the person to /login with a notice instead of straight into the app, since
 *   middleware would just bounce an unauthenticated visit to /visioninspect anyway.
 */
'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/auth/supabase-server';

export async function signUpAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');
  const next = String(formData.get('next') ?? '/visioninspect');

  const fail = (message: string) => {
    redirect(
      `/signup?error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}` +
        `&email=${encodeURIComponent(email)}`,
    );
  };

  if (!email || !password) {
    fail('Email and password are required.');
  }

  if (password.length < 6) {
    fail('Password must be at least 6 characters.');
  }

  if (password !== confirmPassword) {
    fail('Passwords do not match.');
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    fail(error.message || 'Could not create an account. Please try again.');
    return;
  }

  // signUp() with no session back means the account was created but is pending email
  // confirmation (a Supabase project setting, not something this app controls). Send
  // them to sign in once confirmed rather than into a protected page middleware will
  // just redirect away from.
  if (!data.session) {
    redirect(
      `/login?notice=${encodeURIComponent(
        'Account created. Check your email to confirm it, then sign in.',
      )}&next=${encodeURIComponent(next)}`,
    );
  }

  redirect(next);
}
