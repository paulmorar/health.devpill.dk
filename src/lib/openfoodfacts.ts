/**
 * Tiny Open Food Facts (OFF) client.
 *
 * OFF is community-maintained, free, no auth. Fields are inconsistent —
 * lots of products are missing one or more nutrients — so the caller is
 * responsible for filling in blanks.
 *
 * Per OFF's guidelines we send a descriptive User-Agent.
 */
import { z } from "zod";

const OFF_BASE = "https://world.openfoodfacts.org/api/v2/product";
const USER_AGENT = "health.devpill.dk - personal use - github.com/paulmorar";

// OFF nutrients are reported per 100g/ml. We pluck the few we need; the
// schema is permissive because OFF sometimes returns these as strings or
// nulls.
const nutriments = z
  .object({
    "energy-kcal_100g": z.coerce.number().nullable().optional(),
    proteins_100g: z.coerce.number().nullable().optional(),
    carbohydrates_100g: z.coerce.number().nullable().optional(),
    fat_100g: z.coerce.number().nullable().optional(),
  })
  .partial();

const productSchema = z.object({
  status: z.number(),
  product: z
    .object({
      product_name: z.string().nullable().optional(),
      product_name_en: z.string().nullable().optional(),
      brands: z.string().nullable().optional(),
      serving_quantity: z.coerce.number().nullable().optional(), // grams
      nutriments: nutriments.optional(),
    })
    .optional(),
});

export type OffLookupResult = {
  name: string;
  brand: string | null;
  /** Suggested serving size in grams (falls back to 100). */
  servingGrams: number;
  /** Energy in kcal *per the suggested serving*, not per 100g. */
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

/**
 * Look up a barcode (EAN/UPC). Returns `null` if OFF doesn't know it
 * (status !== 1). Throws on network errors.
 */
export async function lookupBarcode(
  barcode: string,
): Promise<OffLookupResult | null> {
  const url = `${OFF_BASE}/${encodeURIComponent(barcode)}.json`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`OFF lookup failed: ${res.status}`);
  }
  const json = productSchema.parse(await res.json());
  if (json.status !== 1 || !json.product) return null;

  const p = json.product;
  const name = (p.product_name_en || p.product_name || "").trim();
  if (!name) return null;

  const serving = p.serving_quantity ?? 100;
  const ratio = serving / 100;
  const n = p.nutriments ?? {};

  const scale = (v: number | null | undefined): number | null =>
    v == null ? null : Math.round(v * ratio * 10) / 10;

  return {
    name,
    brand: p.brands ? p.brands.split(",")[0]!.trim() : null,
    servingGrams: serving,
    kcal: scale(n["energy-kcal_100g"]),
    proteinG: scale(n.proteins_100g),
    carbsG: scale(n.carbohydrates_100g),
    fatG: scale(n.fat_100g),
  };
}
