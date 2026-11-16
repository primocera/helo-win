// Monochrome line icons, drawn for Helo (24x24 grid, stroke = currentColor).
import type { JSX } from 'react';

const paths: Record<string, JSX.Element> = {
  home: (
    <>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6.5 10v8.5h11V10" />
    </>
  ),
  music: (
    <>
      <path d="M9 17.5V6.5l10-2v11" />
      <circle cx="6.8" cy="17.5" r="2.2" />
      <circle cx="16.8" cy="15.5" r="2.2" />
    </>
  ),
  agents: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="3.5" />
      <path d="m7.5 10 2.5 2-2.5 2" />
      <path d="M12.5 14.5h4" />
    </>
  ),
  map: (
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="4" r="1.6" />
      <circle cx="19" cy="15.5" r="1.6" />
      <circle cx="5" cy="15.5" r="1.6" />
      <path d="M12 9V5.6M14.6 13.4l3 1.4M9.4 13.4l-3 1.4" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13.5" r="6.5" />
      <path d="M12 13.5V10" />
      <path d="M10 3.5h4" />
      <path d="m17.5 7 1.3-1.3" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5.5" y="5" width="13" height="15.5" rx="2.5" />
      <rect x="9" y="3.5" width="6" height="3" rx="1.2" />
      <path d="M9 11h6M9 14.5h4" />
    </>
  ),
  notes: (
    <>
      <path d="M6 4.5h8.5L18.5 8.5V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V6A1.5 1.5 0 0 1 6 4.5Z" />
      <path d="M8 11h7M8 14.5h7M8 18h4" />
    </>
  ),
  shelf: (
    <>
      <path d="M3.5 13.5 6 6.5h12l2.5 7" />
      <path d="M3.5 13.5V18a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5v-4.5h-5a3.5 3.5 0 0 1-7 0Z" />
    </>
  ),
  system: (
    <>
      <path d="M5 7h6M15 7h4M5 17h2M11 17h8" />
      <circle cx="13" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  settings: (
    <>
      <path d="M10.3 3.5h3.4l.5 2.4 1.6.9 2.3-.8 1.7 2.9-1.8 1.6v1.9l1.8 1.6-1.7 2.9-2.3-.8-1.6.9-.5 2.4h-3.4l-.5-2.4-1.6-.9-2.3.8-1.7-2.9L6 13V11L4.2 9.4l1.7-2.9 2.3.8 1.6-.9Z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  shuffle: <path d="M3.5 7.5h2.6c1.5 0 2.9.8 3.7 2l3.4 5c.8 1.2 2.2 2 3.7 2h3.6M18 13.5l3 3-3 3M3.5 16.5h2.6c1.1 0 2.2-.4 3-1.2M20.5 7.5h-3.6c-1.1 0-2.2.4-3 1.2M18 4.5l3 3-3 3" />,
  repeat: <path d="M4.5 11.5V10a3 3 0 0 1 3-3h11.5M16 4l3 3-3 3M19.5 12.5V14a3 3 0 0 1-3 3H5M8 20l-3-3 3-3" />,
  repeatOne: (
    <>
      <path d="M4.5 11.5V10a3 3 0 0 1 3-3h11.5M16 4l3 3-3 3M19.5 12.5V14a3 3 0 0 1-3 3H5M8 20l-3-3 3-3" />
      <path d="M11.2 10.7l1.3-.7v4.2" />
    </>
  ),
  play: <path d="M8 5.5v13l10.5-6.5Z" fill="currentColor" />,
  pause: (
    <>
      <rect x="6.5" y="5.5" width="3.8" height="13" rx="1" fill="currentColor" />
      <rect x="13.7" y="5.5" width="3.8" height="13" rx="1" fill="currentColor" />
    </>
  ),
  next: (
    <>
      <path d="M4.5 6.5v11l7.5-5.5Z" fill="currentColor" />
      <path d="M12 6.5v11l7.5-5.5Z" fill="currentColor" />
    </>
  ),
  previous: (
    <>
      <path d="M19.5 6.5v11L12 12Z" fill="currentColor" />
      <path d="M12 6.5v11L4.5 12Z" fill="currentColor" />
    </>
  ),
  speaker: (
    <>
      <path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3Z" fill="currentColor" stroke="none" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  mute: (
    <>
      <path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3Z" fill="currentColor" stroke="none" />
      <path d="m15.5 9.5 5 5M20.5 9.5l-5 5" />
    </>
  ),
  contrast: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M6 11.5a6 6 0 0 0 12 0M12 17.5v3" />
    </>
  ),
  camera: (
    <>
      <rect x="3.5" y="7" width="12" height="10" rx="2.5" />
      <path d="m15.5 10.5 5-3v9l-5-3" />
    </>
  ),
  battery: (
    <>
      <rect x="3.5" y="7.5" width="15" height="9" rx="2.2" />
      <path d="M20.5 10.5v3" />
    </>
  ),
  bolt: <path d="M13 3.5 6.5 13H11l-1 7.5L17.5 11H13Z" fill="currentColor" stroke="none" />,
  cup: (
    <>
      <path d="M5 9.5h11v5a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 14.5Z" />
      <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16M8.5 3.5v3M12 3.5v3" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.2" />
      <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14M10 4.5h4M7 7l1 12.5h8L17 7" />
    </>
  ),
  close: <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />,
  folder: <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4.5l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18Z" />,
  file: (
    <>
      <path d="M7 3.5h7l4.5 4.5v11A1.5 1.5 0 0 1 17 20.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M13.5 3.5V8.5h5" />
    </>
  ),
  check: <path d="m5.5 12.5 4.5 4.5 8.5-9.5" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5M12 8v.5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 21 19.5H3Z" />
      <path d="M12 10v4.5M12 17v.3" />
    </>
  ),
  question: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M9.8 9.6a2.3 2.3 0 1 1 3.2 2.2c-.7.3-1 .8-1 1.5v.4M12 16.5v.3" />
    </>
  ),
  lock: (
    <>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  unlock: (
    <>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.6-1.6" />
    </>
  ),
  convert: (
    <>
      <path d="M5 9h12.5l-3-3M19 15H6.5l3 3" />
    </>
  ),
  bell: (
    <>
      <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2H5Z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  eye: (
    <>
      <path d="M2.8 12S6 5.8 12 5.8 21.2 12 21.2 12 18 18.2 12 18.2 2.8 12 2.8 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
      <path d="M5 19.5h14" />
    </>
  ),
  gamepad: (
    <>
      <path d="M7 8h10a4 4 0 0 1 4 4.5l-.6 3.4a2.4 2.4 0 0 1-4.2 1L14.5 15h-5l-1.7 1.9a2.4 2.4 0 0 1-4.2-1L3 12.5A4 4 0 0 1 7 8Z" />
      <path d="M8 10.5v3M6.5 12h3M15.5 11.2v.3M17.5 13v.3" />
    </>
  ),
  pin: (
    <>
      <circle cx="12" cy="10" r="2.5" />
      <path d="M12 20.5s-6-5.6-6-10.5a6 6 0 0 1 12 0c0 4.9-6 10.5-6 10.5Z" />
    </>
  ),
  skip: (
    <>
      <path d="M6 6.5v11l8-5.5Z" fill="currentColor" stroke="none" />
      <path d="M17.5 6.5v11" />
    </>
  ),
  reset: (
    <>
      <path d="M5.5 12a6.5 6.5 0 1 0 2-4.7" />
      <path d="M5 4.5v3.5h3.5" />
    </>
  ),
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 16, className }: { name: IconName | string; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.info}
    </svg>
  );
}

/** Helo's own app mark: a mint tile with the island-face glyph cut out. */
export function Mark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="0" y="0" width="16" height="16" rx="4.4" fill="#5ef0c4" />
      <circle cx="5.6" cy="8" r="1.7" fill="#04120d" />
      <rect x="8.4" y="7.25" width="3.6" height="1.5" rx="0.75" fill="#04120d" />
    </svg>
  );
}
