// The numbers, laid out like halo-mac.com's: a statement, then three figures, the first counting up (CountUp). Each is checkable in the repo: the feature
// switches in Settings (product.featureSwitches, counted from DEFAULT_FEATURES in app/src/main/settings.ts), no account
// (licensing is a key only, app/src/main/license.ts), and the installer's size (product.downloadMax).
import { product } from "@/lib/product";
import CountUp from "./CountUp";
import WindowsMark from "./WindowsMark";
import shared from "./shared.module.css";
import styles from "./NumbersSection.module.css";

// The first and last figures count up (CountUp), stopping for half a second at a round number and then ticking on.
// "More than 22": the app has product.featureSwitches (23) features with their own switch. "Under 125 MB": the
// installer's size, rounded up (product.downloadMax).
const [downloadNumber, downloadUnit] = product.downloadMax.split(" ");
const download = Number(downloadNumber);

const figures = [
  { key: "features", before: "More than", figure: <><CountUp to={product.featureSwitches - 1} pauseAt={20} className={`${shared.gradient} ${styles.num} ${styles.numGradient}`} /> features</>, after: "in one island" },
  { key: "accounts", before: "Exactly", figure: "0 accounts", after: "a license key is all it asks" },
  { key: "download", before: "Under", figure: <><CountUp to={download} pauseAt={download - 5} className={styles.num} /> {downloadUnit}</>, after: <>download, for <WindowsMark>{product.requirements}</WindowsMark></> },
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
            <b>{f.figure}</b>
            <em>{f.after}</em>
          </div>
        ))}
      </div>
    </section>
  );
}
