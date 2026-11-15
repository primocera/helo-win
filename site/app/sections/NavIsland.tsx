"use client";

// The small island that hangs from the top of the page, in the middle of the nav bar: Blink's calm face and the
// playing bars. Clicking it switches the page's accent between the app's two colours, mint and rose.
import { useEffect, useState } from "react";
import { product } from "@/lib/product";
import styles from "./NavIsland.module.css";

type Accent = "mint" | "rose";

export default function NavIsland() {
  const [accent, setAccent] = useState<Accent>("mint");
  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);
  const other: Accent = accent === "mint" ? "rose" : "mint";
  return (
    <button
      type="button"
      className={styles.island}
      onClick={() => setAccent(other)}
      aria-label={`${product.name}'s island. Switch the accent colour to ${other}.`}
      title={`Accent: ${accent}. Click for ${other}.`}
    >
      <svg className={styles.face} viewBox="0 0 40 30" aria-hidden="true">
        <ellipse cx="14" cy="12.5" rx="4.6" ry="4" />
        <ellipse cx="26" cy="12.5" rx="4.6" ry="4" />
        <path d="M16.5 20.5q3.5 3 7 0" />
      </svg>
      <span className={styles.bars} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
    </button>
  );
}
