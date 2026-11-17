// The numbers, laid out like halo-mac.com's: a statement, then three figures. Each is checkable in the repo: the feature
// switches in Settings (product.featureSwitches, counted from DEFAULT_FEATURES in app/src/main/settings.ts), no account
// (licensing is a key only, app/src/main/license.ts), and the installer's size (product.downloadMax).
import { product } from "@/lib/product";
import WindowsMark from "./WindowsMark";
import shared from "./shared.module.css";
import styles from "./NumbersSection.module.css";

const figures = [
  { before: "More than", figure: "20 features", after: "each with its own switch" },
  { before: "Exactly", figure: "0 accounts", after: "a license key is all it asks" },
  { before: "Under", figure: product.downloadMax, after: <>download, for <WindowsMark>{product.requirements}</WindowsMark></> },
];

export default function NumbersSection() {
  return (
    <section className={styles.section} aria-labelledby="numbers-title">
      <p className={styles.eyebrow}>By the numbers</p>
      <h2 id="numbers-title" className={styles.statement}>
        A lot in a<br />
        <span className={shared.gradient}>little space.</span>
      </h2>
      <div className={styles.stats}>
        {figures.map((f) => (
          <div key={f.figure}>
            <span>{f.before}</span>
            <b>{f.figure}</b>
            <em>{f.after}</em>
          </div>
        ))}
      </div>
    </section>
  );
}
