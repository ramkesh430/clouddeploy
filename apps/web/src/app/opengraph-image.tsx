import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          backgroundColor: "#12172a",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              display: "flex",
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: "#3b82f6",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            C
          </div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>CloudDeploy</div>
        </div>
        <div style={{ fontSize: 56, fontWeight: 700, textAlign: "center", maxWidth: 900 }}>
          Deploy Your Entire Application
        </div>
        <div style={{ fontSize: 30, color: "#60a5fa", fontWeight: 600 }}>Frontend + Backend + Database</div>
        <div style={{ fontSize: 24, color: "rgba(255,255,255,0.65)" }}>From GitHub to production in one click.</div>
      </div>
    ),
    { ...size },
  );
}
