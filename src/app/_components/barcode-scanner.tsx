"use client";

/**
 * Camera-based barcode scanner using ZXing.
 *
 * Opens as a fullscreen modal overlay. Asks for the rear camera
 * (`facingMode: "environment"`) on mobile; on desktop the user can pick.
 * Continuously decodes from the video stream until we see an EAN/UPC, then
 * calls `onDetected(code)` with the digit string. The parent is expected to
 * close the scanner in that callback.
 *
 * Notes:
 * - Requires HTTPS (or localhost). On health.devpill.dk that's the case.
 * - We only accept formats with numeric payloads (EAN-13/8, UPC-A/E). That
 *   matches what Open Food Facts indexes.
 */
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import {
  BarcodeFormat,
  DecodeHintType,
  type Result,
} from "@zxing/library";

const HINTS = new Map<DecodeHintType, unknown>([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
    ],
  ],
  [DecodeHintType.TRY_HARDER, true],
]);

export function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setError("Camera not available in this browser.");
      return;
    }

    const reader = new BrowserMultiFormatReader(HINTS);
    let cancelled = false;
    let controls: { stop: () => void } | null = null;

    (async () => {
      try {
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          videoRef.current!,
          (result: Result | undefined) => {
            if (cancelled || !result) return;
            const text = result.getText().trim();
            // EAN/UPC payloads are all digits; sanity-check.
            if (/^[0-9]{6,14}$/.test(text)) {
              cancelled = true;
              controls?.stop();
              onDetected(text);
            }
          },
        );
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error
            ? err.name === "NotAllowedError"
              ? "Camera permission denied."
              : err.message
            : "Failed to start camera.";
        setError(msg);
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [onDetected]);

  // Close on Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <div className="flex items-center justify-between p-4 text-white">
        <span className="text-sm font-medium">Scan a barcode</span>
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-md border border-white/20 px-3 text-xs font-medium hover:bg-white/10"
        >
          Close
        </button>
      </div>

      <div className="relative flex-1">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />
        {/* Centered guide rectangle. Purely cosmetic — ZXing scans the whole frame. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-32 w-72 rounded-lg border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
      </div>

      {error && (
        <p className="bg-red-950 px-4 py-3 text-center text-sm text-red-200">
          {error}
        </p>
      )}
      <p className="px-4 py-3 text-center text-xs text-white/60">
        Hold steady · good light · EAN-13, EAN-8, UPC-A, UPC-E
      </p>
    </div>
  );
}
