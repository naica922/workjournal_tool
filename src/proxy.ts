import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic, cookie-only route protection. Every server function and route
// handler additionally validates the session against the database.
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (!sessionCookie && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (sessionCookie && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Protect all pages; skip API routes, static assets and files.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
