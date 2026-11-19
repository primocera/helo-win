// Notifications: other apps' Windows notifications shown as a banner on the island (halo-mac.com's "Notifications"
// section, told with what Helo does). Where each claim comes from:
// - The helper (app/resources/winhelper.ps1, Poll-Notifications) reads Windows' own notification list once a second
//   with UserNotificationListener and only reads it: nothing is removed, so Windows keeps its copy. Windows' own banner
//   still shows too ("Never twice" is not built, NEXT_SESSION.md gap 7), hence "also" below.
// - app/src/main/notifications.ts turns one into a banner titled "<app> · <first line>", with the rest as its text,
//   and stores nothing. app/src/main/index.ts shows it for 6 seconds; a click asks the helper to bring the app forward
//   (Open-App, for apps in Windows' app list).
// - Settings lists each app after its first notification, with its own switch (app/src/renderer/src/settings/SettingsApp.tsx).
// - The banner's look: a lavender tile with a bell (kind-notify in island.css, BANNER_ICON in Views.tsx), Blink calm,
//   because a notification does not change the mood (app/src/shared/face.ts).
import type { CSSProperties, ReactNode } from "react";
import { product } from "@/lib/product";
import { Blink, Desktop, Icon } from "./IslandMocks";
import mock from "./IslandMocks.module.css";
import shared from "./shared.module.css";
import styles from "./NotificationsSection.module.css";

// Phosphor Icons, fill weight (MIT, @phosphor-icons/core 2.1.1): cursor-click, list-checks, shield-check.
const POINTS: { title: string; text: string; icon: ReactNode }[] = [
  {
    title: "Click to open.",
    text: "A click brings the app it came from to the front.",
    icon: (
      <path d="M220.49,190.83a12,12,0,0,1,0,17L207.8,220.49a12,12,0,0,1-17,0l-56.56-56.57L115,214.09c0,.1-.08.21-.13.32a15.83,15.83,0,0,1-14.6,9.59l-.79,0a15.83,15.83,0,0,1-14.41-11L32.8,52.92A16,16,0,0,1,52.92,32.8L213,85.07a16,16,0,0,1,1.41,29.8l-.32.13-50.17,19.27ZM96,32a8,8,0,0,0,8-8V16a8,8,0,0,0-16,0v8A8,8,0,0,0,96,32ZM16,104h8a8,8,0,0,0,0-16H16a8,8,0,0,0,0,16ZM124.42,39.16a8,8,0,0,0,10.74-3.58l8-16a8,8,0,0,0-14.31-7.16l-8,16A8,8,0,0,0,124.42,39.16Zm-96,81.69-16,8a8,8,0,0,0,7.16,14.31l16-8a8,8,0,1,0-7.16-14.31Z" />
    ),
  },
  {
    title: "Your apps, your call.",
    text: "Each app gets its own switch in Settings after its first notification.",
    icon: (
      <path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM117.66,149.66l-32,32a8,8,0,0,1-11.32,0l-16-16a8,8,0,0,1,11.32-11.32L80,164.69l26.34-26.35a8,8,0,0,1,11.32,11.32Zm0-64-32,32a8,8,0,0,1-11.32,0l-16-16A8,8,0,0,1,69.66,90.34L80,100.69l26.34-26.35a8,8,0,0,1,11.32,11.32ZM192,168H144a8,8,0,0,1,0-16h48a8,8,0,0,1,0,16Zm0-64H144a8,8,0,0,1,0-16h48a8,8,0,0,1,0,16Z" />
    ),
  },
  {
    title: "Shown, not saved.",
    text: `${product.name} shows each one once and keeps nothing. Windows still keeps its own copy.`,
    icon: (
      <path d="M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.26,47,25.53a8,8,0,0,0,4.2,0c1-.27,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm-34.32,69.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z" />
    ),
  },
];

/** A notification banner, as the app draws one (banner mode, 440 wide, radius 22), with Blink calm beside it. */
function MockNotification({
  app = "Messages",
  from = "Mom",
  text = "Dinner at 8? I made your favourite. Bring the salad if you can.",
}: {
  app?: string;
  from?: string;
  text?: string;
}) {
  const title = `${app} · ${from}`;
  const size = { "--iw-w": 440, "--iw-n": 340, "--ih-w": 62, "--ih-n": 62 } as CSSProperties;
  return (
    <div className={`${mock.top} ${mock.n540}`} style={size} role="img" aria-label={`A notification on the island: ${title}. ${text}`}>
      <Blink face="calm" />
      <div className={`${mock.island} ${mock.rBanner}`}>
        <div className={mock.banner}>
          <span className={`${mock.appIcon} ${styles.kindNotify}`}>
            <Icon name="bell" size={17} />
          </span>
          <span className={mock.bannerLines}>
            <span className={mock.bannerTitle}>{title}</span>
            <span className={mock.bannerText}>{text}</span>
          </span>
          <span className={mock.bannerTime}>now</span>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsSection() {
  return (
    <section className={`${shared.black} ${shared.section}`} aria-labelledby="notifications-title">
      <div className={`${shared.wrap} ${styles.wrap}`}>
        <p className={styles.eyebrow}>Notifications</p>
        <h2 id="notifications-title" className={styles.headline}>
          Your messages.
          <br />
          <span className={shared.gradient}>Right where you look.</span>
        </h2>
        <p className={styles.lead}>
          Chat, mail, reminders: when an app sends a Windows notification, it also shows in the island at the top of your
          screen. Read it at a glance, click to open the app, or let it slip away.
        </p>

        <Desktop className={styles.desk}>
          <MockNotification />
        </Desktop>

        <ul className={styles.points}>
          {POINTS.map((p) => (
            <li key={p.title} className={styles.point}>
              <svg className={styles.pointIcon} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                {p.icon}
              </svg>
              <h3 className={styles.pointTitle}>{p.title}</h3>
              <p className={styles.pointText}>{p.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
