/**
 * Edge middleware: redirect unauthenticated users to /signin for all routes
 * except /signin itself, auth API routes, and Next.js internals.
 */
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthRoute =
    pathname.startsWith("/signin") || pathname.startsWith("/api/auth");

  if (!req.auth && !isAuthRoute) {
    const signinUrl = new URL("/signin", req.nextUrl);
    return NextResponse.redirect(signinUrl);
  }
  return NextResponse.next();
});

export const config = {
  // Match everything except Next.js internals and static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
