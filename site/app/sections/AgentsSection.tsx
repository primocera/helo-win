// "Built for AI agents": three cards with the island answering, reporting and listing agent work, then four short
// points. Everything here is drawn by IslandMocks; no state, so this stays a server component.
import { product } from "@/lib/product";
import { Desktop, MockAgentsTab, MockDoneBanner, MockQuestion } from "./IslandMocks";
import shared from "./shared.module.css";
import styles from "./AgentsSection.module.css";

const ICON = {
  // Two changed lines: one taken out (red), one put in (green).
  diff: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="3" />
      <path d="M7 9.5h4" stroke="#ff7b72" />
      <path d="M7 14.5h4M9 12.5v4" stroke="#5fd38d" />
      <path d="M14 9.5h3M14 14.5h3" />
    </>
  ),
  // A small keyboard.
  keys: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14.2h8" />
    </>
  ),
  // A list of steps, the first two ticked.
  plan: (
    <>
      <path d="m3.8 6.8 1.6 1.6 2.9-3.1M11 7h9.5" />
      <path d="m3.8 12.3 1.6 1.6 2.9-3.1M11 12.5h9.5" />
      <path d="M5.6 18h.01M11 18h9.5" />
    </>
  ),
  // A tick inside a circle that comes back round on itself.
  always: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.8 4.2v3.6h-3.6" />
      <path d="m8.8 12.2 2.2 2.2 4.3-4.6" />
    </>
  ),
};

const POINTS: { icon: keyof typeof ICON; title: string; text: string }[] = [
  {
    icon: "diff",
    title: "See the change first",
    text: "Edit and Write requests from Claude Code show the changed lines in red and green before you allow them.",
  },
  {
    icon: "keys",
    title: "Yes or no from the keyboard",
    text: "Alt+Shift+Y allows and Alt+Shift+N denies the request on the island, from any app, while one is waiting.",
  },
  {
    icon: "plan",
    title: "Approve the plan",
    text: "Read Claude Code's plan on the island and approve it, or reject it and it keeps planning.",
  },
  {
    icon: "always",
    title: "Always allow",
    text: "When Claude Code offers a rule for the request, one click allows it and saves the rule.",
  },
];

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
          <article className={styles.card}>
            <Desktop className={styles.shot}>
              <MockQuestion />
            </Desktop>
            <div className={styles.text}>
              <h3 className={styles.cardTitle}>Answer without switching windows.</h3>
              <p className={styles.cardText}>
                Requests from Claude Code and Codex open in the island, and so do Claude Code&apos;s questions and plans.
                Pick an answer there, or send it back to the terminal to type your own.
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

        <ul className={styles.points}>
          {POINTS.map((p) => (
            <li key={p.title} className={styles.point}>
              <svg
                className={styles.pointIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {ICON[p.icon]}
              </svg>
              <h3 className={`${shared.pointTitle} ${styles.pointTitle}`}>{p.title}</h3>
              <p className={`${shared.pointText} ${styles.pointText}`}>{p.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
