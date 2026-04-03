/**
 * Single place for Supabase URL + publishable/anon key.
 * Supports dashboard naming: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
 * and classic: NEXT_PUBLIC_SUPABASE_ANON_KEY
 * Server-only duplicates help Vercel Edge middleware (see .env.local.example).
 */
export function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim()
}

export function getSupabasePublishableKey(): string {
  return (
    process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim()
}
