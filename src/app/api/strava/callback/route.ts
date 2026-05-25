/**
 * Strava OAuth callback handler.
 *
 * Strava redirects the user here after they authorize (or deny) the app.
 * We verify the state cookie, exchange the code for tokens, and upsert
 * a row into strava_connections.
 *
 * Errors are returned via query params on a redirect back to "/" — keeps
 * the UX simple without a dedicated error page in v1.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { stravaConnections } from "@/db/schema";
import { exchangeCodeForToken } from "@/lib/strava";
import { STRAVA_STATE_COOKIE } from "@/lib/strava";

function backHome(req: NextRequest, error?: string): NextResponse {
  const url = new URL("/", req.nextUrl);
  if (error) url.searchParams.set("strava_error", error);
  else url.searchParams.set("strava_connected", "1");
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/signin", req.nextUrl));
  }

  const params = req.nextUrl.searchParams;
  const error = params.get("error");
  const code = params.get("code");
  const scope = params.get("scope") ?? "";
  const state = params.get("state");

  // CSRF: state from Strava must match the one we stored in the cookie.
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STRAVA_STATE_COOKIE)?.value;
  cookieStore.delete(STRAVA_STATE_COOKIE);

  if (error) return backHome(req, error);
  if (!code || !state) return backHome(req, "missing_params");
  if (!expectedState || expectedState !== state) {
    return backHome(req, "state_mismatch");
  }

  // Strava only grants the scopes the user actually approved. Require the
  // ones we asked for — otherwise the integration would silently be useless.
  if (!scope.split(",").includes("activity:read_all")) {
    return backHome(req, "missing_scope");
  }

  let token;
  try {
    token = await exchangeCodeForToken(code);
  } catch (e) {
    console.error("[strava callback] token exchange failed", e);
    return backHome(req, "token_exchange_failed");
  }

  const expiresAt = new Date(token.expires_at * 1000);

  await db
    .insert(stravaConnections)
    .values({
      userId: session.user.id,
      athleteId: token.athlete.id,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt,
      scope,
      athleteFirstname: token.athlete.firstname ?? null,
      athleteLastname: token.athlete.lastname ?? null,
      athleteUsername: token.athlete.username ?? null,
      athleteProfile: token.athlete.profile ?? null,
    })
    .onConflictDoUpdate({
      target: stravaConnections.userId,
      set: {
        athleteId: token.athlete.id,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt,
        scope,
        athleteFirstname: token.athlete.firstname ?? null,
        athleteLastname: token.athlete.lastname ?? null,
        athleteUsername: token.athlete.username ?? null,
        athleteProfile: token.athlete.profile ?? null,
      },
    });

  return backHome(req);
}
