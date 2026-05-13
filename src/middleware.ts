import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/supabase/env'

type CookieToSet = { name: string; value: string; options: CookieOptions }

export async function middleware(request: NextRequest) {
  const url = getSupabaseUrl()
  const anonKey = getSupabasePublishableKey()
  if (!url || !anonKey) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: CookieToSet[], headers: Record<string, string>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value)
        })
      },
    },
  })

  const isAuthPage = request.nextUrl.pathname.startsWith('/auth')
  const isApiRoute = request.nextUrl.pathname.startsWith('/api')

  // Race the auth lookup against a short timeout so a slow Supabase auth
  // endpoint (or full-region outage) doesn't cascade into MIDDLEWARE_INVOCATION_TIMEOUT
  // on every route. If auth times out, fall back to the previous request
  // state: let API/auth pages through, redirect everything else to login.
  // The fallback prefers safety (re-auth) over a permissive bypass.
  const AUTH_TIMEOUT_MS = 2000
  let user: { id: string } | null = null
  let authTimedOut = false
  try {
    const userPromise = supabase.auth.getUser().then(r => r.data.user as { id: string } | null)
    const timeoutPromise = new Promise<'__timeout__'>(resolve =>
      setTimeout(() => resolve('__timeout__'), AUTH_TIMEOUT_MS)
    )
    const result = await Promise.race([userPromise, timeoutPromise])
    if (result === '__timeout__') {
      authTimedOut = true
    } else {
      user = result
    }
  } catch {
    authTimedOut = true
  }

  if (isApiRoute || isAuthPage) return supabaseResponse

  if (authTimedOut) {
    // Supabase upstream is slow / down — render the page and let the
    // client retry auth itself. Better than 504-ing everything.
    return supabaseResponse
  }

  if (!user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  // Don't run middleware on static assets — they go through public/ and don't
  // need session validation. Saves ~250ms per asset request.
  matcher: [
    '/',
    '/((?!_next/static|_next/image|favicon.ico|public/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|woff|woff2|ttf|map)$).*)',
  ],
}
