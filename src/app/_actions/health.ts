/**
 * Server actions for manual food + wellness logging (Phase 2).
 *
 * All actions require an authenticated session; they read `userId` from the
 * session rather than trusting client input.
 */
"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { foodLogs, goals, wellnessLogs } from "@/db/schema";

// ─── Food ────────────────────────────────────────────────────────

const foodSchema = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().max(120).optional(),
  barcode: z
    .string()
    .regex(/^[0-9]{6,14}$/)
    .optional(),
  servingGrams: z.coerce.number().positive().max(10_000),
  kcal: z.coerce.number().min(0).max(20_000),
  proteinG: z.coerce.number().min(0).max(2000).optional(),
  carbsG: z.coerce.number().min(0).max(2000).optional(),
  fatG: z.coerce.number().min(0).max(2000).optional(),
  // ISO datetime string from <input type="datetime-local"> (no seconds).
  consumedAt: z.string().min(1),
  source: z.enum(["manual", "openfoodfacts"]).default("manual"),
});

export type FoodActionResult = { ok: true } | { ok: false; error: string };

function emptyToUndef(v: FormDataEntryValue | null): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

export async function addFoodLogAction(
  _prev: FoodActionResult | null,
  formData: FormData,
): Promise<FoodActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Not signed in" };

  const parsed = foodSchema.safeParse({
    name: emptyToUndef(formData.get("name")),
    brand: emptyToUndef(formData.get("brand")),
    barcode: emptyToUndef(formData.get("barcode")),
    servingGrams: emptyToUndef(formData.get("servingGrams")),
    kcal: emptyToUndef(formData.get("kcal")),
    proteinG: emptyToUndef(formData.get("proteinG")),
    carbsG: emptyToUndef(formData.get("carbsG")),
    fatG: emptyToUndef(formData.get("fatG")),
    consumedAt: emptyToUndef(formData.get("consumedAt")),
    source: emptyToUndef(formData.get("source")) ?? "manual",
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const d = parsed.data;
  await db.insert(foodLogs).values({
    userId,
    consumedAt: new Date(d.consumedAt),
    name: d.name,
    brand: d.brand ?? null,
    barcode: d.barcode ?? null,
    servingGrams: d.servingGrams,
    kcal: d.kcal,
    proteinG: d.proteinG ?? null,
    carbsG: d.carbsG ?? null,
    fatG: d.fatG ?? null,
    source: d.source,
  });
  revalidatePath("/");
  return { ok: true };
}

export async function deleteFoodLogAction(formData: FormData): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  const id = formData.get("id");
  if (typeof id !== "string" || id === "") return;
  await db
    .delete(foodLogs)
    .where(and(eq(foodLogs.id, id), eq(foodLogs.userId, userId)));
  revalidatePath("/");
}

// ─── Wellness ────────────────────────────────────────────────────

const wellnessSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.coerce.number().positive().max(500).optional(),
  sleepHours: z.coerce.number().min(0).max(24).optional(),
  sleepScore: z.coerce.number().int().min(0).max(100).optional(),
  vo2max: z.coerce.number().min(0).max(100).optional(),
  mood: z.coerce.number().int().min(1).max(10).optional(),
  energy: z.coerce.number().int().min(1).max(10).optional(),
  notes: z.string().max(2000).optional(),
});

export type WellnessActionResult = { ok: true } | { ok: false; error: string };

export async function upsertWellnessLogAction(
  _prev: WellnessActionResult | null,
  formData: FormData,
): Promise<WellnessActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Not signed in" };

  const parsed = wellnessSchema.safeParse({
    date: emptyToUndef(formData.get("date")),
    weightKg: emptyToUndef(formData.get("weightKg")),
    sleepHours: emptyToUndef(formData.get("sleepHours")),
    sleepScore: emptyToUndef(formData.get("sleepScore")),
    vo2max: emptyToUndef(formData.get("vo2max")),
    mood: emptyToUndef(formData.get("mood")),
    energy: emptyToUndef(formData.get("energy")),
    notes: emptyToUndef(formData.get("notes")),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const d = parsed.data;

  await db
    .insert(wellnessLogs)
    .values({
      userId,
      date: d.date,
      weightKg: d.weightKg ?? null,
      sleepHours: d.sleepHours ?? null,
      sleepScore: d.sleepScore ?? null,
      vo2max: d.vo2max ?? null,
      mood: d.mood ?? null,
      energy: d.energy ?? null,
      notes: d.notes ?? null,
    })
    .onConflictDoUpdate({
      target: [wellnessLogs.userId, wellnessLogs.date],
      set: {
        weightKg: d.weightKg ?? null,
        sleepHours: d.sleepHours ?? null,
        sleepScore: d.sleepScore ?? null,
        vo2max: d.vo2max ?? null,
        mood: d.mood ?? null,
        energy: d.energy ?? null,
        notes: d.notes ?? null,
        updatedAt: sql`now()`,
      },
    });

  revalidatePath("/");
  return { ok: true };
}

// ─── Goals ────────────────────────────────────────────────────────

const goalsSchema = z.object({
  dailyKcal: z.coerce.number().int().min(0).max(20_000).optional(),
  dailyProteinG: z.coerce.number().int().min(0).max(1000).optional(),
  dailyCarbsG: z.coerce.number().int().min(0).max(2000).optional(),
  dailyFatG: z.coerce.number().int().min(0).max(1000).optional(),
  weeklyActiveKm: z.coerce.number().min(0).max(1000).optional(),
  weeklyActiveMinutes: z.coerce.number().int().min(0).max(10_000).optional(),
  weeklyActivitiesCount: z.coerce.number().int().min(0).max(100).optional(),
  targetWeightKg: z.coerce.number().positive().max(500).optional(),
  dailySleepHours: z.coerce.number().min(0).max(24).optional(),
});

export type GoalsActionResult = { ok: true } | { ok: false; error: string };

export async function upsertGoalsAction(
  _prev: GoalsActionResult | null,
  formData: FormData,
): Promise<GoalsActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Not signed in" };

  const parsed = goalsSchema.safeParse({
    dailyKcal: emptyToUndef(formData.get("dailyKcal")),
    dailyProteinG: emptyToUndef(formData.get("dailyProteinG")),
    dailyCarbsG: emptyToUndef(formData.get("dailyCarbsG")),
    dailyFatG: emptyToUndef(formData.get("dailyFatG")),
    weeklyActiveKm: emptyToUndef(formData.get("weeklyActiveKm")),
    weeklyActiveMinutes: emptyToUndef(formData.get("weeklyActiveMinutes")),
    weeklyActivitiesCount: emptyToUndef(formData.get("weeklyActivitiesCount")),
    targetWeightKg: emptyToUndef(formData.get("targetWeightKg")),
    dailySleepHours: emptyToUndef(formData.get("dailySleepHours")),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const d = parsed.data;
  const row = {
    userId,
    dailyKcal: d.dailyKcal ?? null,
    dailyProteinG: d.dailyProteinG ?? null,
    dailyCarbsG: d.dailyCarbsG ?? null,
    dailyFatG: d.dailyFatG ?? null,
    weeklyActiveKm: d.weeklyActiveKm ?? null,
    weeklyActiveMinutes: d.weeklyActiveMinutes ?? null,
    weeklyActivitiesCount: d.weeklyActivitiesCount ?? null,
    targetWeightKg: d.targetWeightKg ?? null,
    dailySleepHours: d.dailySleepHours ?? null,
  };

  await db
    .insert(goals)
    .values(row)
    .onConflictDoUpdate({
      target: goals.userId,
      set: { ...row, updatedAt: sql`now()` },
    });

  revalidatePath("/");
  return { ok: true };
}
