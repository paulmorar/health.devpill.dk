import { ImageResponse } from "next/og";

// 180x180 Apple touch icon — wordmark + emerald accent dot
// on the same near-black canvas devpill.dk uses.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const runtime = "edge";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#05060a",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "0 22px",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          <span>health</span>
          <span
            style={{
              width: 12,
              height: 12,
              marginLeft: 6,
              borderRadius: 9999,
              background: "#10b981",
              display: "inline-block",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 10,
            fontSize: 32,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color: "#a1a1aa",
          }}
        >
          devpill
        </div>
      </div>
    ),
    { ...size },
  );
}
