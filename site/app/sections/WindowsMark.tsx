// A small Windows symbol (Phosphor's filled "squares-four", lib/featureIcons.ts) set before a line's "Windows 10 or 11",
// sized to the text and in the text's own colour. The icon and the words stay together on one line.
import type { ReactNode } from "react";
import { squaresFour } from "@/lib/featureIcons";
import styles from "./WindowsMark.module.css";

export default function WindowsMark({ children }: { children: ReactNode }) {
  return (
    <span className={styles.mark}>
      <svg
        className={styles.icon}
        viewBox="40 40 176 176"
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
        dangerouslySetInnerHTML={{ __html: squaresFour }}
      />
      {children}
    </span>
  );
}
