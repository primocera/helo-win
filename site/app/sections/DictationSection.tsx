// Dictation, as halo-mac.com's "Dictation" chapter (index.html #dictation: .ch-light, .sh.big, .desk.desk-lg with the
// island listening and a Notes window, then a fine line), told with what Helo does. Where each claim comes from:
// - Hold-to-talk: the helper (app/resources/winhelper.ps1, HeloHelper.Dictation) watches the key; held alone for
//   250 ms it listens with Windows' own speech recognition (System.Speech, on the PC); let go and the words are typed
//   where the cursor is, as key presses into the window that has the keyboard. Another key while holding cancels.
// - The keys: Right Ctrl (default), Right Shift or Right Alt (DICTATION_KEY_NAMES in app/src/shared/dictation.ts).
// - The island shows "Listening" and the end of the words so far (DictationView in app/src/renderer/src/island/Views.tsx).
// - Off until turned on in Settings, Features, Dictation (DEFAULT_FEATURES in app/src/main/settings.ts). There,
//   "Whisper, with your Groq key" records while the key is held and sends it to Groq (app/src/main/groq.ts).
import type { CSSProperties } from "react";
import { Blink, Desktop, Icon } from "./IslandMocks";
import mock from "./IslandMocks.module.css";
import shared from "./shared.module.css";
import styles from "./DictationSection.module.css";

const WORDS = "Ship the new landing page tonight and send the film to the team.";

// The languages, as halo-mac.com's pills, with Chinese and Slovenian. Windows' own speech recognition covers English, Spanish,
// German and French (and Japanese and Chinese); the rest come with Whisper on Groq, with the user's own key
// (app/src/main/groq.ts), which writes out dozens of languages.
const LANGUAGES = ["English", "Español", "Deutsch", "Français", "Italiano", "Português", "中文", "Slovenščina"];

/**
 * The island while you talk, as the app draws it (DictationView): Blink joined at the left, a mic and level bars in
 * the top row, and the words so far under them.
 */
function MockListening() {
  const size = { "--iw-w": 440, "--iw-n": 340, "--ih-w": 62, "--ih-n": 62 } as CSSProperties;
  return (
    <div className={`${mock.top} ${mock.n540} ${styles.listen}`} style={size}>
      <Blink face="calm" />
      <div className={`${mock.island} ${mock.rBanner}`}>
        <div className={styles.listenInner}>
          <span className={styles.listenRow}>
            <Icon name="mic" size={14} className={styles.mic} />
            <span className={styles.bars} aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
          </span>
          <span className={styles.words}>{WORDS.slice(0, -1)}</span>
        </div>
      </div>
    </div>
  );
}

export default function DictationSection() {
  return (
    <section className={`${shared.grey} ${shared.section}`} aria-labelledby="dictation-title">
      <div className={`${shared.wrap} ${styles.wrap}`}>
        <p className={styles.eyebrow}>Dictation</p>
        <h2 id="dictation-title" className={styles.headline}>
          Hold Right Ctrl.
          <br />
          <span className={shared.gradientDark}>Just talk.</span>
        </h2>
        <p className={styles.lead}>
          Hold the key and say what you want to write. Your words show up in the island as you speak, and when you let
          go, they land wherever the cursor is: a message, an email, a terminal. Use Right Ctrl, Right Shift or Right
          Alt.
        </p>

        <Desktop className={styles.desk}>
          <div
            className={styles.scene}
            role="img"
            aria-label={`The island listening, with the words so far, and a Notepad window where they are typed: ${WORDS}`}
          >
            <MockListening />
            <div className={styles.note} aria-hidden="true">
              <div className={styles.noteBar}>
                <span className={styles.noteTitle}>Untitled - Notepad</span>
                <span className={styles.noteButtons}>
                  <i />
                  <i />
                  <i />
                </span>
              </div>
              <p className={styles.noteText}>
                <span className={styles.caretStart}>
                  <span className={styles.caret} />
                </span>
                <span className={styles.typed}>{WORDS}</span>
                <span className={styles.caretEnd}>
                  <span className={styles.caret} />
                </span>
              </p>
            </div>
          </div>
        </Desktop>

        <ul className={styles.langs} aria-label="Some of the languages it writes">
          {LANGUAGES.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className={styles.fine}>
          Free, with Windows&apos; own speech recognition, on your PC once Windows has the speech pack for your
          language. Or add your own Groq key for Whisper and dozens more languages.
        </p>
      </div>
    </section>
  );
}
