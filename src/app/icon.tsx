import { ImageResponse } from "next/og";

// Next file-based icon. Mirrors devpill.dk's favicon style:
// lowercase glyph + accent dot on a near-black background.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";
export const runtime = "edge";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#05060a",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: "-0.05em",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto",
      }}
    >
      <span style={{ display: "flex", alignItems: "baseline" }}>
        <span>h</span>
        <span
          style={{
            width: 5,
            height: 5,
            marginLeft: 2,
            borderRadius: 9999,
            background: "#10b981",
            display: "inline-block",
          }}
        />
      </span>
    </div>,
    { ...size },
  );
}
