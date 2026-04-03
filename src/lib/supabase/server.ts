import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/supabase/env'

type CookieToSet = { name: string; value: string; options: CookieOptions }

export function createClient() {
  const cookieStore = cookies()
  const url = getSupabaseUrl()
  const key = getSupabasePublishableKey()
  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: CookieToSet[], _headers: Record<string, string>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
            /* Response cache headers belong on middleware response; RSC/API often cannot set them here. */
          } catch {}
        },
      },
    }
  )
}
