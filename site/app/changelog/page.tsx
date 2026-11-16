// The changelog page. The entries live in lib/product.ts (`changelog`); add a version there in the same commit as
// the app change it describes. It shares the privacy page's plain text styles.
import type { Metadata } from "next";
import Link from "next/link";
import { changelog, product } from "@/lib/product";
import styles from "../privacy/privacy.module.css";

export const metadata: Metadata = {
  title: `Changelog: ${product.name}`,
  description: `What is new in each version of ${product.name}.`,
};

function dateText(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default function ChangelogPage() {
  const n = product.name;
  return (
    <main className={styles.page}>
      <Link className={styles.back} href="/">
        ← {n}
      </Link>
      <h1 className={styles.title}>Changelog</h1>
      <p className={styles.updated}>What is new in each version of {n}.</p>

      {changelog.map((entry) => (
        <section key={entry.version} aria-labelledby={`v-${entry.version}`}>
          <h2 id={`v-${entry.version}`}>
            {n} {entry.version}
          </h2>
          <p className={styles.updated}>{entry.date ? dateText(entry.date) : "Not released yet. This is what it will ship with."}</p>
          <p>{entry.summary}</p>
          {entry.groups.map((group) => (
            <div key={group.title}>
              <h3>{group.title}</h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
