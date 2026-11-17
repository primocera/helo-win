// "Built for AI agents": three cards with the island answering, reporting and listing agent work. The islands are drawn by IslandMocks; the question card is AgentQuestion, a client component the visitor
// can answer. This section itself has no state, so it stays a server component.
import { product } from "@/lib/product";
import AgentQuestion from "./AgentQuestion";
import { Desktop, MockAgentsTab, MockDoneBanner } from "./IslandMocks";
import shared from "./shared.module.css";
import styles from "./AgentsSection.module.css";

export default function AgentsSection() {
  return (
    <section className={`${shared.section} ${shared.black}`} aria-labelledby="agents-title">
      <div className={shared.wrap}>
        <div className={shared.center}>
          <p className={shared.eyebrow}>Built for AI agents</p>
          <h2 id="agents-title" className={shared.headline}>
            When your agent asks, <span className={shared.gradient}>answer from the island.</span>
          </h2>
          <p className={shared.lead}>
            {product.name} works with Claude Code and Codex CLI. Their requests and finished tasks come to the top of
            your screen, so you do not have to go looking for the right terminal. Gemini CLI and Cursor show up too:
            working, finished, and for Gemini CLI, waiting for you.
          </p>
        </div>

        <div className={styles.cards}>
          <article className={`${styles.card} ${styles.ask}`}>
            <AgentQuestion className={styles.shot} />
            <div className={styles.text}>
              <h3 className={styles.cardTitle}>Answer without switching windows.</h3>
              <p className={styles.cardText}>
                Requests from Claude Code and Codex open in the island, and so do Claude Code&apos;s questions and plans.
                Pick an answer or type your own there, and the agent gets back to work.
              </p>
            </div>
          </article>

          <article className={styles.card}>
            <Desktop className={styles.shot}>
              <MockDoneBanner />
            </Desktop>
            <div className={styles.text}>
              <h3 className={styles.cardTitle}>Know when it is done.</h3>
              <p className={styles.cardText}>
                When an agent finishes, a banner names the project, how long it worked and how its last message begins.
                If it needs an answer, that banner stays up until you click it or answer in the terminal.
              </p>
            </div>
          </article>

          <article className={`${styles.card} ${styles.wide}`}>
            <Desktop className={styles.shot}>
              <MockAgentsTab />
            </Desktop>
            <div className={styles.text}>
              <h3 className={styles.cardTitle}>Every session in one tab.</h3>
              <p className={styles.cardText}>
                The Agents tab lists your Claude Code, Codex, Gemini CLI and Cursor sessions and whether each is
                working, waiting for you or done. On Pro, Max and Ultra plans, two rings show how much of your Claude 5-hour and weekly limits you
                have used.
              </p>
            </div>
          </article>
        </div>

      </div>
    </section>
  );
}
