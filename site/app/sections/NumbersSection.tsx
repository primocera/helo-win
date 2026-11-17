// The numbers, laid out like halo-mac.com's: a statement, then three figures that count up as Halo's do (CountUp). Each is checkable in the repo: the feature
// switches in Settings (product.featureSwitches, counted from DEFAULT_FEATURES in app/src/main/settings.ts), no account
// (licensing is a key only, app/src/main/license.ts), and the installer's size (product.downloadMax).
import { product } from "@/lib/product";
import CountUp from "./CountUp";
import WindowsMark from "./WindowsMark";
import shared from "./shared.module.css";
import styles from "./NumbersSection.module.css";

// The installer's size as a number and its unit ("125 MB"), so the number can count up.
const [downloadNumber, downloadUnit] = product.downloadMax.split(" ");

const figures = [
  { key: "features", before: "Exactly", to: product.featureSwitches, unit: "features", after: "each with its own switch" },
  { key: "accounts", before: "Exactly", to: 0, unit: "accounts", after: "a license key is all it asks" },
  { key: "download", before: "Under", to: Number(downloadNumber), unit: downloadUnit, after: <>download, for <WindowsMark>{product.requirements}</WindowsMark></> },
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
          <div key={f.key}>
            <span>{f.before}</span>
            <b>
              <CountUp to={f.to} /> {f.unit}
            </b>
            <em>{f.after}</em>
          </div>
        ))}
      </div>
    </section>
  );
}
