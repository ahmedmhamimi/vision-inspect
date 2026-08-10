/**
 * supabase-server.ts
 * The one place that constructs a Supabase client bound to the current request's auth
 * cookies, for use in Server Components, Route Handlers, and Server Actions. Uses the
 * publishable anon key + the caller's session cookie — NOT the service_role key, so this
 * client is always subject to RLS and can only ever act as the signed-in user, never as
 * an admin bypassing row security. That's a deliberate contrast with
 * SupabaseStorageAdapter (which intentionally uses service_role, server-only, to read/
 * write inspection data regardless of RLS) — auth session-checking and inspection-data
 * storage are different trust boundaries and must not share a client.
 *
 * - createSupabaseServerClient(): async because Next.js 14's `cookies()` must be awaited
 *   before it can be read inside a Route Handler / Server Component context.
 */
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/ai/providers';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Called from a Server Component render, where cookies() is read-only. Safe
          // to ignore here because middleware.ts is what actually refreshes and
          // persists the session cookie on every request (see middleware.ts).
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {
          // Same read-only-render case as set() above.
        }
      },
    },
  });
}
