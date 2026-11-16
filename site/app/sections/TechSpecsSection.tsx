// The tech specs table. The lines live in lib/product.ts (`specs`), each beside the app file that proves it.
import { specs } from "@/lib/product";
import shared from "./shared.module.css";
import styles from "./TechSpecsSection.module.css";

export default function TechSpecsSection() {
  return (
    <section id="specs" className={`${shared.grey} ${shared.section}`} aria-labelledby="specs-title">
      <div className={shared.wrap}>
        <h2 id="specs-title" className={`${shared.headline} ${shared.center}`}>
          Tech <span className={shared.gradientDark}>specs.</span>
        </h2>

        <dl className={styles.table}>
          {specs.map((spec) => (
            <div key={spec.name} className={styles.row}>
              <dt className={styles.name}>{spec.name}</dt>
              <dd className={styles.lines}>
                {spec.lines.map((line) => (
                  <span key={line} className={styles.line}>
                    {line}
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
