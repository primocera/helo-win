// The other features, laid out like halo-mac.com's "All new" list (v2.css .allnew, .an-grid): a filled icon, a bold
// title and one grey sentence each, three across. The features and their wording come from site/lib/product.ts.
import { utilities, type Feature } from "@/lib/product";
import { featureIcons } from "@/lib/featureIcons";
import styles from "./SmallThingsSection.module.css";

// The public build lists only what the app really does today.
const showAll = process.env.NODE_ENV !== "production";

function Icon({ title }: { title: string }) {
  const inner = featureIcons[title];
  if (!inner) return <span className={styles.icon} />;
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

export default function SmallThingsSection() {
  const list = utilities.filter((f: Feature) => showAll || f.shipped);
  if (list.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="small-things">
      <div className={styles.wrap}>
        <h2 id="small-things" className={styles.title}>
          And the small things.
        </h2>
        <ul className={styles.grid}>
          {list.map((f) => (
            <li key={f.title}>
              <Icon title={f.title} />
              <h3>
                {f.title}
                {!f.shipped && <span className={styles.tag}> (not built yet)</span>}
              </h3>
              <p>{f.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
