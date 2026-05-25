/**
 * GET /api/food/barcode/[code]
 *
 * Auth-gated proxy to Open Food Facts. Returns a small normalized shape the
 * food form can drop straight into its fields, or 404 if OFF doesn't know
 * the product.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { lookupBarcode } from "@/lib/openfoodfacts";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { code } = await ctx.params;
  if (!/^[0-9]{6,14}$/.test(code)) {
    return NextResponse.json({ error: "invalid_barcode" }, { status: 400 });
  }

  try {
    const product = await lookupBarcode(code);
    if (!product) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(product);
  } catch (err) {
    console.error("openfoodfacts lookup failed", err);
    return NextResponse.json({ error: "upstream_failed" }, { status: 502 });
  }
}
