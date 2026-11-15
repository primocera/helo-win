import styles from "./page.module.css";
import { faq, headline, product, utilities, type Feature } from "@/lib/product";

// The public build lists only what the app really does today.
const showAll = process.env.NODE_ENV !== "production";
const visible = (list: Feature[]) => list.filter((f) => showAll || f.shipped);

function Tag({ feature }: { feature: Feature }) {
  return feature.shipped ? null : <span className={styles.tag}>not built yet</span>;
}

export default function Home() {
  const main = visible(headline);
  const extra = visible(utilities);

  return (
    <>
      <header className={styles.nav}>
        <span className={styles.brand}>{product.name}</span>
        <a className={styles.buySmall} href={product.buyUrl}>
          Buy
        </a>
      </header>

      <main>
        <section className={styles.hero}>
          <h1>{product.name}</h1>
          <p className={styles.sub}>{product.tagline}</p>
          <p className={styles.lead}>
            The top of your screen has been doing nothing. {product.name} puts your coding agents, your music and
            everything you are waiting on in it.
          </p>

          <div className={styles.screen} aria-hidden="true">
            <div className={styles.island}>
              <div className={styles.cardHead}>
                <span className={styles.tool}>Bash</span>
                <span className={styles.project}>my-project</span>
              </div>
              <code className={styles.command}>npm install &amp;&amp; npm run build</code>
              <div className={styles.actions}>
                <span className={styles.deny}>Deny</span>
                <span className={styles.allow}>Allow</span>
              </div>
            </div>
          </div>

          <a className={styles.buy} href={product.buyUrl}>
            Buy · {product.price}
          </a>
          <p className={styles.small}>
            One-time purchase · {product.trialDays}-day free trial · {product.requirements}
          </p>
        </section>

        <section className={styles.features}>
          {main.map((f) => (
            <article key={f.title} className={styles.feature}>
              <h2>
                {f.title} <Tag feature={f} />
              </h2>
              <p>{f.text}</p>
            </article>
          ))}
        </section>

        {extra.length > 0 && (
          <section className={styles.dark}>
            <h2>And the small things</h2>
            <div className={styles.grid}>
              {extra.map((f) => (
                <div key={f.title} className={styles.tile}>
                  <h3>
                    {f.title} <Tag feature={f} />
                  </h3>
                  <p>{f.text}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className={styles.faq}>
          <h2>Questions</h2>
          {faq.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </section>

        <section className={styles.closing}>
          <h2>{product.price}. Once.</h2>
          <a className={styles.buy} href={product.buyUrl}>
            Buy {product.name}
          </a>
        </section>
      </main>

      <footer className={styles.footer}>
        © {product.name}. Made by an independent developer.
      </footer>
    </>
  );
}
