import { createBrowserClient } from '@supabase/ssr'
import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/supabase/env'

/** Lets `next build` prerender client pages when env is not present (e.g. CI); real keys required at runtime. */
const BUILD_PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const BUILD_PLACEHOLDER_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.build-without-supabase-env'

export function createClient() {
  let url = getSupabaseUrl()
  let key = getSupabasePublishableKey()

  if (!url || !key) {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      url = BUILD_PLACEHOLDER_URL
      key = BUILD_PLACEHOLDER_KEY
    } else if (process.env.NODE_ENV === 'development') {
      url = url || 'http://127.0.0.1:54321'
      key = key || 'dev-placeholder-anon-key'
    } else {
      throw new Error(
        'Missing Supabase env: set NEXT_PUBLIC_SUPABASE_URL and a publishable/anon key (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, *_PUBLISHABLE_DEFAULT_KEY, or *_ANON_KEY). See .env.local.example.'
      )
    }
  }

  return createBrowserClient(url, key)
}
