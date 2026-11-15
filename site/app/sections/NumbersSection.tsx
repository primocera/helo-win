// Three figures, each one checkable in the repo: the feature switches in Settings (product.featureSwitches, counted
// from DEFAULT_FEATURES in app/src/main/settings.ts), no account (licensing is a key only, app/src/main/license.ts),
// and the one-time price (app/src/main/config.ts).
import { product } from "@/lib/product";
import shared from "./shared.module.css";
import styles from "./NumbersSection.module.css";

const figures = [
  { word: "Features", figure: String(product.featureSwitches), line: "Each one with its own switch in Settings." },
  { word: "Accounts", figure: "0", line: "Nothing to sign up for. A license key is all it asks." },
  { word: "Paid", figure: product.price, line: `Once, for up to ${product.maxPcs} PCs. No subscription.` },
];

export default function NumbersSection() {
  return (
    <section className={`${shared.black} ${shared.section}`} aria-labelledby="numbers-title">
      <div className={`${shared.wrap} ${shared.center}`}>
        <p className={shared.eyebrow}>By the numbers</p>
        <h2 id="numbers-title" className={shared.headline}>
          A lot in a <span className={shared.gradient}>little space.</span>
        </h2>

        <dl className={styles.figures}>
          {figures.map((f) => (
            <div key={f.word} className={styles.item}>
              <dt className={styles.word}>{f.word}</dt>
              <dd className={styles.figure}>{f.figure}</dd>
              <dd className={styles.line}>{f.line}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
