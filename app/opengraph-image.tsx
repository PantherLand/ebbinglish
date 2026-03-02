import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Ebbinglish – English vocabulary with spaced repetition";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #4f46e5 0%, #0ea5e9 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top: brand name */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: "rgba(255,255,255,0.75)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            Ebbinglish
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            Learn English words
            <br />
            that actually stick.
          </div>
        </div>

        {/* Bottom: subtitle + tags */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 28, color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>
            Spaced repetition · Round-based review · YouGlish pronunciation
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {["Spaced Repetition", "YouGlish", "Flashcards"].map((tag) => (
              <div
                key={tag}
                style={{
                  padding: "8px 20px",
                  borderRadius: 999,
                  border: "1.5px solid rgba(255,255,255,0.4)",
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 20,
                  fontWeight: 500,
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
