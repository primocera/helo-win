// What Helo is, in one paragraph: grey words, with the phrases that matter in white.
import { product } from "@/lib/product";
import shared from "./shared.module.css";
import styles from "./IntroSection.module.css";

export default function IntroSection() {
  return (
    <section className={`${shared.black} ${styles.section}`} aria-label={`What ${product.name} is`}>
      <div className={shared.wrap}>
        <p className={styles.statement} data-scroll-light>
          {product.name} is <strong>an island for the top of your Windows screen</strong>.{" "}
          <strong>Your coding agents</strong>, <strong>your music</strong>, <strong>your files</strong> and{" "}
          <strong>whatever you are waiting on</strong> all live in it. It <strong>stays small until something
          happens</strong>. Then it opens to show you, and gets out of the way again.
        </p>
      </div>
    </section>
  );
}
