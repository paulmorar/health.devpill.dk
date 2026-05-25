/**
 * Inngest serve endpoint. Inngest (cloud or dev server) polls this URL to
 * discover functions and POSTs here to execute steps.
 *
 * Auth: in production Inngest signs requests with `INNGEST_SIGNING_KEY` and
 * the SDK verifies the signature for us — no extra middleware needed.
 */
import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
