// External monitor controls. What the app does: brightness (VCP 0x10), contrast (0x12) and input (0x60) over DDC/CI,
// through the helper (app/src/main/index.ts, app/src/renderer/src/island/Panel.tsx). Monitors that do not answer a
// control simply do not get it; one that answers nothing reads "Does not support DDC/CI" in the panel.
import { monitorInputs, product } from "@/lib/product";
import shared from "./shared.module.css";
import styles from "./MonitorSection.module.css";

function listInputs(list: string[]): string {
  return list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : list.join("");
}

export default function MonitorSection() {
  return (
    <section className={`${shared.white} ${shared.section}`} aria-labelledby="monitor-title">
      <div className={`${shared.wrap} ${shared.center}`}>
        <p className={shared.eyebrow}>Monitor controls</p>
        <h2 id="monitor-title" className={shared.headline}>
          Your monitor, <span className={shared.gradientDark}>from the island.</span>
        </h2>
        <p className={shared.lead}>
          On external monitors that support DDC/CI, {product.name} sets brightness and contrast and switches the input.
          No more feeling for the buttons on the back of the screen.
        </p>

        <div className={styles.monitor} aria-hidden="true">
          <div className={styles.bezel}>
            <div className={`${shared.desktop} ${styles.screen}`}>
              <span className={styles.pill} />
            </div>
          </div>
          <div className={styles.neck} />
          <div className={styles.base} />
        </div>

        <ul className={styles.points}>
          <li>
            <h3 className={shared.pointTitle}>Brightness and contrast</h3>
            <p className={shared.pointText}>
              A slider for each. A control your monitor does not offer is left out, and a monitor that does not answer
              at all says so.
            </p>
          </li>
          <li>
            <h3 className={shared.pointTitle}>Input</h3>
            <p className={shared.pointText}>
              Switch between {listInputs(monitorInputs)}. Pick one this PC is not plugged into and that screen goes
              dark, so choose with care.
            </p>
          </li>
          <li>
            <h3 className={shared.pointTitle}>Every screen</h3>
            <p className={shared.pointText}>Each external monitor gets its own row in the panel.</p>
          </li>
        </ul>
      </div>
    </section>
  );
}
