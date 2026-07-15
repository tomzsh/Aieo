import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE_HINT = /sb-.*-auth-token|supabase.*auth/i;

function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => AUTH_COOKIE_HINT.test(c.name));
}

/** Race a promise against a timeout — prevents blank hung pages when Supabase is slow */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch(() => {
      clearTimeout(t);
      resolve(null);
    });
  });
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const path = request.nextUrl.pathname;

  // Fast path: health + static
  if (path.startsWith("/api/health") || path.startsWith("/_next")) {
    return supabaseResponse;
  }

  const isAuthPage =
    path.startsWith("/login") || path.startsWith("/signup");
  const isPublic =
    path === "/" ||
    isAuthPage ||
    path.startsWith("/docs") ||
    path.startsWith("/api/health");

  // No auth cookie → skip network call (landing/login stay fast)
  if (!hasAuthCookie(request)) {
    if (!isPublic && !path.startsWith("/api/")) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/login";
      redirect.searchParams.set("next", path);
      return NextResponse.redirect(redirect);
    }
    return supabaseResponse;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Cap wait — hung Supabase used to leave the browser on a white page
  const userResult = await withTimeout(
    supabase.auth.getUser().then((r) => r.data.user),
    4000
  );

  // Timeout / error: allow public; protect private with soft redirect
  if (userResult === null) {
    if (!isPublic && !path.startsWith("/api/")) {
      // Prefer showing app shell if cookie exists but network failed —
      // client will re-auth. Only redirect when clearly unauthenticated path.
      return supabaseResponse;
    }
    return supabaseResponse;
  }

  const user = userResult;

  if (!user && !isPublic && !path.startsWith("/api/")) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", path);
    return NextResponse.redirect(redirect);
  }

  if (user && isAuthPage) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/dashboard";
    return NextResponse.redirect(redirect);
  }

  return supabaseResponse;
}
