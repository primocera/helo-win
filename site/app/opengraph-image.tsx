// The picture shown when the site's link is shared: the island with Blink beside it, and the tagline.
import { ImageResponse } from "next/og";
import { product } from "@/lib/product";

export const alt = `${product.name}: ${product.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: "linear-gradient(160deg, #d9d2c5 0%, #9d9ca8 45%, #2a2c38 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <div
            style={{
              width: 92,
              height: 64,
              marginRight: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#000000",
              borderBottomLeftRadius: 22,
              borderBottomRightRadius: 22,
            }}
          >
            <div style={{ width: 12, height: 12, borderRadius: 6, background: "#ffffff", marginRight: 12 }} />
            <div style={{ width: 12, height: 12, borderRadius: 6, background: "#ffffff" }} />
          </div>
          <div
            style={{
              width: 560,
              height: 96,
              display: "flex",
              alignItems: "center",
              padding: "0 34px",
              background: "#000000",
              borderBottomLeftRadius: 34,
              borderBottomRightRadius: 34,
              fontSize: 30,
            }}
          >
            <div style={{ width: 16, height: 16, borderRadius: 8, background: "#6fd08c", marginRight: 16 }} />
            <div style={{ display: "flex", flexGrow: 1 }}>Finished in shop-api</div>
            <div style={{ display: "flex", color: "#9a9aa4" }}>+48 −12</div>
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 150, fontSize: 104, fontWeight: 700, letterSpacing: -3 }}>{product.name}</div>
        <div style={{ display: "flex", marginTop: 14, fontSize: 40, color: "#e9e9ee" }}>{product.tagline}</div>
        <div style={{ display: "flex", marginTop: 26, fontSize: 28, color: "#c9c9d2" }}>
          {product.price} once · {product.requirements}
        </div>
      </div>
    ),
    size,
  );
}
