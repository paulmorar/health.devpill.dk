"use client";

/**
 * Food logging form with optional Open Food Facts barcode lookup.
 *
 * Flow:
 *  1. User pastes/types a barcode → clicks "Look up" → we hit
 *     `/api/food/barcode/[code]` and prefill name/serving/macros.
 *  2. User edits anything if needed and submits.
 *
 * Submission goes through `addFoodLogAction`; on success we clear the form
 * so the next entry is fast.
 */
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { addFoodLogAction, type FoodActionResult } from "@/app/_actions/health";

// Lazy-load the camera scanner so the ZXing bundle (~50kb) only ships when
// the user actually opens it.
const BarcodeScanner = dynamic(
  () =>
    import("@/app/_components/barcode-scanner").then((m) => m.BarcodeScanner),
  { ssr: false },
);

function toDatetimeLocalNow(): string {
  // <input type="datetime-local"> wants "YYYY-MM-DDTHH:MM" in *local* time.
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isoIsToday(iso?: string): boolean {
  if (!iso) return true;
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const todayLocalIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )}`;
  return iso === todayLocalIso;
}

// Resolve the initial value for the datetime-local input. For today, use
// "now"; for a past day picked via the Day tab, use noon of that day so it
// lands inside the day's window when stored as UTC.
function initialConsumedAt(defaultDate?: string): string {
  if (!defaultDate || isoIsToday(defaultDate)) return toDatetimeLocalNow();
  return `${defaultDate}T12:00`;
}

export function FoodLogForm({ defaultDate }: { defaultDate?: string } = {}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, formAction, pending] = useActionState<
    FoodActionResult | null,
    FormData
  >(addFoodLogAction, null);
  const [source, setSource] = useState<"manual" | "openfoodfacts">("manual");
  const [lookup, setLookup] = useState<{
    pending: boolean;
    error: string | null;
  }>({ pending: false, error: null });
  const [scannerOpen, setScannerOpen] = useState(false);
  const [now, setNow] = useState<string>(""); // set on client to avoid SSR mismatch

  useEffect(() => {
    setNow(initialConsumedAt(defaultDate));
  }, [defaultDate]);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setSource("manual");
      setNow(initialConsumedAt(defaultDate));
    }
  }, [state, defaultDate]);

  const handleLookup = useCallback(async (barcodeArg?: string) => {
    const form = formRef.current;
    if (!form) return;
    const barcode = (
      barcodeArg ??
      (form.elements.namedItem("barcode") as HTMLInputElement)?.value
    ).trim();
    if (!barcode) return;
    setLookup({ pending: true, error: null });
    try {
      const res = await fetch(
        `/api/food/barcode/${encodeURIComponent(barcode)}`,
      );
      if (res.status === 404) {
        setLookup({ pending: false, error: "Not found in Open Food Facts." });
        return;
      }
      if (!res.ok) {
        setLookup({ pending: false, error: `Lookup failed (${res.status}).` });
        return;
      }
      const product = (await res.json()) as {
        name: string;
        brand: string | null;
        servingGrams: number;
        kcal: number | null;
        proteinG: number | null;
        carbsG: number | null;
        fatG: number | null;
      };
      const setVal = (name: string, v: string | number | null) => {
        const el = form.elements.namedItem(name) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | null;
        if (el) el.value = v == null ? "" : String(v);
      };
      setVal("name", product.name);
      setVal("brand", product.brand);
      setVal("servingGrams", product.servingGrams);
      setVal("kcal", product.kcal);
      setVal("proteinG", product.proteinG);
      setVal("carbsG", product.carbsG);
      setVal("fatG", product.fatG);
      setSource("openfoodfacts");
      setLookup({ pending: false, error: null });
    } catch (err) {
      setLookup({
        pending: false,
        error: err instanceof Error ? err.message : "Lookup failed",
      });
    }
  }, []);

  const handleScanned = useCallback(
    (code: string) => {
      // Reflect into the visible input so the user sees what was scanned,
      // then auto-trigger the OFF lookup.
      const form = formRef.current;
      const input = form?.elements.namedItem("barcode") as
        | HTMLInputElement
        | undefined;
      if (input) input.value = code;
      setScannerOpen(false);
      void handleLookup(code);
    },
    [handleLookup],
  );

  const inputCls =
    "h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-800 dark:bg-zinc-950";
  const labelCls = "text-xs font-medium text-zinc-500";

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="source" value={source} />

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label htmlFor="food-barcode" className={labelCls}>
            Barcode (optional)
          </label>
          <input
            id="food-barcode"
            name="barcode"
            inputMode="numeric"
            pattern="[0-9]{6,14}"
            placeholder="e.g. 5701234567890"
            className={inputCls}
          />
        </div>
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="h-9 rounded-md border border-zinc-200 px-3 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          aria-label="Scan barcode with camera"
        >
          Scan
        </button>
        <button
          type="button"
          onClick={() => void handleLookup()}
          disabled={lookup.pending}
          className="h-9 rounded-md border border-zinc-200 px-3 text-xs font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          {lookup.pending ? "Looking up…" : "Look up"}
        </button>
      </div>

      {scannerOpen && (
        <BarcodeScanner
          onDetected={handleScanned}
          onClose={() => setScannerOpen(false)}
        />
      )}
      {lookup.error && (
        <p className="text-xs text-red-600 dark:text-red-400">{lookup.error}</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1">
          <label htmlFor="food-name" className={labelCls}>
            Name *
          </label>
          <input id="food-name" name="name" required className={inputCls} />
        </div>
        <div className="space-y-1">
          <label htmlFor="food-brand" className={labelCls}>
            Brand
          </label>
          <input id="food-brand" name="brand" className={inputCls} />
        </div>
        <div className="space-y-1">
          <label htmlFor="food-serving" className={labelCls}>
            Serving (g) *
          </label>
          <input
            id="food-serving"
            name="servingGrams"
            type="number"
            step="0.1"
            min="0"
            required
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="food-kcal" className={labelCls}>
            kcal *
          </label>
          <input
            id="food-kcal"
            name="kcal"
            type="number"
            step="0.1"
            min="0"
            required
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="food-protein" className={labelCls}>
            Protein (g)
          </label>
          <input
            id="food-protein"
            name="proteinG"
            type="number"
            step="0.1"
            min="0"
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="food-carbs" className={labelCls}>
            Carbs (g)
          </label>
          <input
            id="food-carbs"
            name="carbsG"
            type="number"
            step="0.1"
            min="0"
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="food-fat" className={labelCls}>
            Fat (g)
          </label>
          <input
            id="food-fat"
            name="fatG"
            type="number"
            step="0.1"
            min="0"
            className={inputCls}
          />
        </div>
        <div className="col-span-2 space-y-1">
          <label htmlFor="food-consumed" className={labelCls}>
            Consumed at *
          </label>
          <input
            id="food-consumed"
            name="consumedAt"
            type="datetime-local"
            required
            defaultValue={now}
            key={now /* re-mount when reset */}
            className={inputCls}
          />
        </div>
      </div>

      {state && !state.ok && (
        <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          Logged.
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Saving…" : "Add food"}
        </button>
        <button
          type="button"
          onClick={() => {
            formRef.current?.reset();
            setSource("manual");
            setLookup({ pending: false, error: null });
            setNow(initialConsumedAt(defaultDate));
          }}
          className="h-9 rounded-md border border-zinc-200 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
