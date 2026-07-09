import { ImageResponse } from "next/og";

// Route segment config — statically generated at build time.
export const alt = "upExpense — Personal expense tracking";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The brand mark, inlined as a data URI so Satori can render it without a
// network fetch. Emerald tile + white bars + up-arrow — matches app/icon.svg.
const LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#10b981"/><g fill="#ffffff"><rect x="13" y="36" width="8" height="14" rx="3"/><rect x="25" y="28" width="8" height="22" rx="3"/><rect x="37" y="24" width="8" height="26" rx="3"/><path d="M41 8 L51.5 21.5 H30.5 Z"/></g></svg>`
)}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "radial-gradient(1200px 630px at 20% 0%, #0b271f 0%, #0a0a0a 55%)",
          padding: "88px",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand lockup */}
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} width={120} height={120} alt="" />
          <div style={{ display: "flex", fontSize: 68, fontWeight: 800 }}>
            <span style={{ color: "#10b981" }}>up</span>
            <span>Expense</span>
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            Track daily expenses.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 40,
              fontWeight: 500,
              color: "#a1a1aa",
            }}
          >
            Daily entries, categories, and reports that turn habits into insight.
          </div>
        </div>

        {/* Footer accent bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              width: 56,
              height: 8,
              borderRadius: 999,
              background: "#10b981",
            }}
          />
          <div style={{ display: "flex", fontSize: 28, color: "#71717a" }}>
            Your money, organized.
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
