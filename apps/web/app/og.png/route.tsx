import { ImageResponse } from "next/og";

export const dynamic = "force-static";

/** The social card, drawn at build: the name, the promise, the cobalt and gold of the brand. */
export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "linear-gradient(135deg, #10172a 0%, #0f1018 55%, #0c0c0e 100%)", color: "#f4f4f5", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, background: "linear-gradient(45deg, #355fe9, #a27807)", borderRadius: 12 }} />
          <div style={{ fontSize: 64, fontWeight: 800 }}>Kachizaka</div>
        </div>
        <div style={{ fontSize: 48, fontWeight: 700, marginTop: 40 }}>Predict with friends. Rules nobody can bend.</div>
        <div style={{ fontSize: 28, marginTop: 20, color: "#a1a1aa" }}>Points only — rules sealed at kick-off, standings live, a league that remembers.</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
