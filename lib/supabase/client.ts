import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!,
    { cookieOptions: { secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 } },
  )
}
