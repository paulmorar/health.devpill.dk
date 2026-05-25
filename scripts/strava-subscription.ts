#!/usr/bin/env -S pnpm tsx
/**
 * Manage the Strava push subscription (only one is allowed per app).
 *
 * Usage (loads `.env.local` automatically via dotenv):
 *   pnpm strava:sub list
 *   pnpm strava:sub create   # uses APP_PUBLIC_URL + STRAVA_WEBHOOK_VERIFY_TOKEN
 *   pnpm strava:sub delete <id>
 *
 * Required env:
 *   STRAVA_CLIENT_ID
 *   STRAVA_CLIENT_SECRET
 *   STRAVA_WEBHOOK_VERIFY_TOKEN
 *   APP_PUBLIC_URL                 // e.g. https://health.devpill.dk
 *
 * Notes:
 *   - The callback URL must be HTTPS and publicly reachable. For local
 *     testing, expose your dev server with `ngrok http 3000` and set
 *     APP_PUBLIC_URL to the resulting https URL.
 *   - Strava verifies the callback synchronously during `create`. If it
 *     can't reach it or the verify token doesn't match, the API call fails.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const API = "https://www.strava.com/api/v3/push_subscriptions";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

function clientCreds() {
  return {
    client_id: requireEnv("STRAVA_CLIENT_ID"),
    client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
  };
}

async function list() {
  const url = new URL(API);
  const { client_id, client_secret } = clientCreds();
  url.searchParams.set("client_id", client_id);
  url.searchParams.set("client_secret", client_secret);
  const res = await fetch(url);
  const body = await res.text();
  console.log(res.status, body);
}

async function create() {
  const { client_id, client_secret } = clientCreds();
  const verifyToken = requireEnv("STRAVA_WEBHOOK_VERIFY_TOKEN");
  const publicUrl = requireEnv("APP_PUBLIC_URL").replace(/\/$/, "");
  const callbackUrl = `${publicUrl}/api/strava/webhook`;
  console.log(`Registering callback: ${callbackUrl}`);
  const form = new URLSearchParams({
    client_id,
    client_secret,
    callback_url: callbackUrl,
    verify_token: verifyToken,
  });
  const res = await fetch(API, { method: "POST", body: form });
  const body = await res.text();
  console.log(res.status, body);
}

async function del(id: string) {
  if (!id) {
    console.error("Usage: pnpm strava:sub delete <id>");
    process.exit(1);
  }
  const { client_id, client_secret } = clientCreds();
  const form = new URLSearchParams({ client_id, client_secret });
  const res = await fetch(`${API}/${id}`, { method: "DELETE", body: form });
  const body = await res.text();
  console.log(res.status, body || "(empty)");
}

const [, , cmd, arg] = process.argv;

async function main() {
  switch (cmd) {
    case "list":
      await list();
      break;
    case "create":
      await create();
      break;
    case "delete":
      await del(arg);
      break;
    default:
      console.error("Usage: pnpm strava:sub <list|create|delete [id]>");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
