// Dictation, as halo-mac.com's "Dictation" chapter (index.html #dictation: .ch-light, .sh.big, .desk.desk-lg with the
// island listening and a Notes window, then a fine line), told with what Helo does. Where each claim comes from:
// - Hold-to-talk: the helper (app/resources/winhelper.ps1, HeloHelper.Dictation) watches the key; held alone for
//   250 ms it listens with Windows' own speech recognition (System.Speech, on the PC); let go and the words are typed
//   where the cursor is, as key presses into the window that has the keyboard. Another key while holding cancels.
// - The keys: Right Ctrl (default), Right Shift or Right Alt (DICTATION_KEY_NAMES in app/src/shared/dictation.ts).
// - The island shows "Listening" and the end of the words so far (DictationView in app/src/renderer/src/island/Views.tsx).
// - Off until turned on in Settings, Features, Dictation (DEFAULT_FEATURES in app/src/main/settings.ts).
import type { CSSProperties } from "react";
import { Blink, Desktop, Icon } from "./IslandMocks";
import mock from "./IslandMocks.module.css";
import shared from "./shared.module.css";
import styles from "./DictationSection.module.css";

const WORDS = "Ship the new landing page tonight and send the film to the team.";

/** The island while you talk: a mic tile, "Listening" and the words so far, level bars; Blink beside it. */
function MockListening() {
  const size = { "--iw-w": 440, "--iw-n": 340, "--ih-w": 62, "--ih-n": 62 } as CSSProperties;
  return (
    <div className={`${mock.top} ${mock.n540} ${styles.listen}`} style={size}>
      <Blink face="calm" />
      <div className={`${mock.island} ${mock.rBanner}`}>
        <div className={mock.banner}>
          <span className={`${mock.appIcon} ${styles.micTile}`}>
            <Icon name="mic" size={17} />
          </span>
          <span className={mock.bannerLines}>
            <span className={mock.bannerTitle}>Listening</span>
            <span className={mock.bannerText}>{WORDS.slice(0, -1)}</span>
          </span>
          <span className={styles.bars} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
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

        <p className={styles.fine}>
          Free, with Windows&apos; own speech recognition, on your PC: nothing is sent anywhere. Off until you turn it on
          in Settings.
        </p>
      </div>
    </section>
  );
}
