import { NextRequest, NextResponse } from 'next/server'

// Paths that must stay reachable without a session:
// - /login and /api/auth: the login flow itself
// - /api/cron/*: called by Vercel cron (no session cookie), authenticates
//   itself via the CRON_SECRET bearer token inside the route
const PUBLIC_PATHS = ['/login', '/api/auth', '/api/cron']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  const token = request.cookies.get('auth_token')?.value
  const expected = process.env.AUTH_TOKEN_VALUE

  if (!expected || !token || token !== expected) {
    // API calls get a 401; page loads redirect to the login form
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
