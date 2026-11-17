"use client";

// The small island that hangs from the top of the page, in the middle of the nav bar: Blink's calm face and the
// playing bars. Clicking it switches the page's accent between the app's two colours, rose (first) and mint.
// EndSection finds it by data-nav-island: at the end of the page a black shape grows out of it over the page, and
// afterwards it stays plain black, as Halo's does, until the page is loaded again.
import { useEffect, useState } from "react";
import { product } from "@/lib/product";
import { CALM, FINALE_EVENT } from "@/lib/blink";
import styles from "./NavIsland.module.css";

type Accent = "mint" | "rose";

export default function NavIsland() {
  const [accent, setAccent] = useState<Accent>("rose");
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);
  useEffect(() => {
    const on = () => setEnded(true);
    window.addEventListener(FINALE_EVENT, on);
    return () => window.removeEventListener(FINALE_EVENT, on);
  }, []);
  const other: Accent = accent === "mint" ? "rose" : "mint";
  return (
    <button
      type="button"
      className={`${styles.island} ${ended ? styles.finale : ""}`}
      data-nav-island
      onClick={() => setAccent(other)}
      aria-label={`${product.name}'s island. Switch the accent colour to ${other}.`}
      title={`Accent: ${accent}. Click for ${other}.`}
    >
      <svg className={styles.face} viewBox="4 3 32 24" aria-hidden="true">
        <path d={CALM.eyes[0]} />
        <path d={CALM.eyes[1]} />
        <path d={CALM.mouth} />
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
