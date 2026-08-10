/**
 * middleware.ts
 * Two jobs, both required for Supabase Auth to work correctly in the App Router:
 *
 * 1. Refresh the auth session on every request and re-write the (possibly rotated)
 *    session cookie onto the response. Without this, sessions silently expire mid-visit
 *    because Server Components can read cookies but cannot reliably write them back
 *    (see the try/catch in lib/auth/supabase-server.ts) — middleware is the one place
 *    Next.js guarantees a response can always set cookies.
 * 2. Gate the authenticated areas of the app: anyone not signed in is redirected to
 *    /login before a protected page even starts rendering. This is the first line of
 *    defense; requireAdmin() in app/admin/layout.tsx is the second, since role isn't
 *    cheaply available at the edge without an extra DB round trip per request.
 *
 * Deliberately does NOT check admin role here — only "signed in or not". Role-gating
 * /admin happens in app/admin/layout.tsx via requireAdmin(), which runs server-side with
 * full access to public.profiles.
 *
 * /login and /signup are intentionally left out of PROTECTED_PREFIXES: sign-up is now
 * open to anyone (see app/signup), so both must stay reachable while signed out.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const PROTECTED_PREFIXES = ['/visioninspect', '/admin'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  // If auth env vars aren't configured, fail open rather than locking out local dev
  // that hasn't set up Supabase yet — the analyze/report APIs still require their own
  // env vars independently, so this is not a security-relevant bypass in practice.
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: '', ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));

  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', path);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on everything except Next.js internals and static assets, so the session
     * cookie stays fresh across the whole app — but the actual redirect-to-/login
     * gating above only applies to PROTECTED_PREFIXES.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif)$).*)',
  ],
};
