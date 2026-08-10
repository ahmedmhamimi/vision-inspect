/**
 * route.ts (/logout)
 * Signs the current user out server-side (clears the session cookie) and redirects to
 * /login. A Route Handler rather than a client-side supabase.auth.signOut() call so the
 * cookie is reliably cleared in one place regardless of which page the sign-out button
 * appears on (see AuthBar in app/visioninspect/layout.tsx and app/admin/layout.tsx).
 */
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/auth/supabase-server';

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', request.url));
}
