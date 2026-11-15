// Helo's mark, drawn in code (no image assets): a small island pill with one
// round "eye" and a short bar, i.e. the island with a face. Used for the tray
// icon at runtime and, through scripts/make-icon.mts, for the installer icon.

type RGBA = [number, number, number, number];

export interface MarkStyle {
  /** Dark rounded-square tile behind the pill (app icon), or none (tray). */
  tile: boolean;
  pill: RGBA;
}

export const MINT: RGBA = [94, 240, 196, 255];
export const WHITE: RGBA = [255, 255, 255, 255];
const TILE: RGBA = [16, 16, 18, 255];

function roundRect(x: number, y: number, cx: number, cy: number, w: number, h: number, r: number): boolean {
  const dx = Math.max(Math.abs(x - cx) - (w / 2 - r), 0);
  const dy = Math.max(Math.abs(y - cy) - (h / 2 - r), 0);
  return dx * dx + dy * dy <= r * r;
}

/** Returns size*size RGBA pixels (straight alpha), 4x4 supersampled. */
export function drawMark(size: number, style: MarkStyle): Buffer {
  const buf = Buffer.alloc(size * size * 4);
  const ss = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = (px + (sx + 0.5) / ss) / size;
          const y = (py + (sy + 0.5) / ss) / size;
          let c: RGBA | null = null;
          if (style.tile && roundRect(x, y, 0.5, 0.5, 0.92, 0.92, 0.22)) c = TILE;
          const inPill = style.tile ? roundRect(x, y, 0.5, 0.5, 0.7, 0.34, 0.17) : roundRect(x, y, 0.5, 0.5, 0.94, 0.5, 0.25);
          if (inPill) {
            const eye = style.tile ? (x - 0.34) ** 2 + (y - 0.5) ** 2 <= 0.075 ** 2 : (x - 0.27) ** 2 + (y - 0.5) ** 2 <= 0.11 ** 2;
            const bar = style.tile ? roundRect(x, y, 0.63, 0.5, 0.17, 0.07, 0.035) : roundRect(x, y, 0.66, 0.5, 0.26, 0.11, 0.055);
            c = eye || bar ? (style.tile ? TILE : null) : style.pill;
          }
          if (c) {
            const alpha = c[3] / 255;
            r += c[0] * alpha; g += c[1] * alpha; b += c[2] * alpha; a += alpha;
          }
        }
      }
      const n = ss * ss;
      const i = (py * size + px) * 4;
      if (a > 0) {
        buf[i] = Math.round(r / a);
        buf[i + 1] = Math.round(g / a);
        buf[i + 2] = Math.round(b / a);
      }
      buf[i + 3] = Math.round((a / n) * 255);
    }
  }
  return buf;
}

/** Same pixels as BGRA, which nativeImage.createFromBitmap expects on Windows. */
export function toBGRA(rgba: Buffer): Buffer {
  const out = Buffer.from(rgba);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = rgba[i + 2];
    out[i + 2] = rgba[i];
  }
  return out;
}
