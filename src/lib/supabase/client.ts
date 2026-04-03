import { createBrowserClient } from '@supabase/ssr'

/** Lets `next build` prerender client pages when env is not present (e.g. CI); real keys required at runtime. */
const BUILD_PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const BUILD_PLACEHOLDER_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.build-without-supabase-env'

export function createClient() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  let key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!url || !key) {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      url = BUILD_PLACEHOLDER_URL
      key = BUILD_PLACEHOLDER_KEY
    } else if (process.env.NODE_ENV === 'development') {
      url = url || 'http://127.0.0.1:54321'
      key = key || 'dev-placeholder-anon-key'
    } else {
      throw new Error(
        'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local (see .env.local.example).'
      )
    }
  }

  return createBrowserClient(url, key)
}
