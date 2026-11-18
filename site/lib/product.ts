// One place for everything the site says about the product.
// Keep it in step with the app's config: name, price, trial, checkout link (app/src/main/config.ts),
// The site does not mention the trial for now (the user's choice, 2026-11-18); trialDays stays for when it does.
// and the feature switches (DEFAULT_FEATURES in app/src/main/settings.ts).
export const product = {
  name: "Helo", // placeholder until the final name is chosen
  mascot: "Blink",
  tagline: "The island for your Windows screen",
  price: "$9.99",
  trialDays: 7,
  maxPcs: 3,
  buyUrl: "https://example.com/buy", // checkout page (not set up yet)
  requirements: "Windows 10 or 11",
  // The installer's size, rounded up: app/dist/Helo-Setup-0.1.0.exe was 122,297,542 bytes on 2026-11-17.
  // Change it when the installer grows past it.
  downloadMax: "125 MB",
  // The link scheme the app registers (app/src/main/links.ts). It keeps the old name until the app is renamed.
  scheme: "helo",
  // Where the site is served. Used for the sitemap and the share image; change it when the real domain is set.
  siteUrl: "https://helo-win.vercel.app",
  // How many features have their own on/off switch in Settings: the keys of DEFAULT_FEATURES in
  // app/src/main/settings.ts (agents, map, usage, mascot, media, lyrics, timer, clipboard, notes, shelf, keepAwake,
  // battery, privacy, hud, displays, calendar, converter, downloads, steam, watchApp, notifications, disk, dictation). Recount when that list changes.
  featureSwitches: 23,
  // The version in app/package.json.
  version: "0.1",
};

// The inputs the island offers on a monitor that reports its input over DDC/CI (DDC_INPUTS in app/src/main/winhelper.ts).
export const monitorInputs = ["DP 1", "DP 2", "HDMI 1", "HDMI 2", "USB-C"];

export type Feature = {
  title: string;
  text: string;
  // Only features marked shipped appear on the public (production) site.
  // In development every feature is shown, with a "not built yet" tag.
  shipped: boolean;
};

export const headline: Feature[] = [
  {
    title: "Answer your coding agent without leaving your work",
    text: "When Claude Code or Codex CLI asks to run something, the island opens with what it wants to do. Allow or deny with a click, or with Alt+Shift+Y and Alt+Shift+N. Claude Code's questions and plans can be answered there too, by picking or by typing, and its edits show the lines they change.",
    shipped: true,
  },
  {
    title: "Know the moment it's done",
    text: "A banner when your agent finishes or needs an answer, for Claude Code, Codex CLI, Gemini CLI and Cursor, and a soft sound when it needs you. Click it to go to the terminal or editor that session is in. The same for browser downloads and Steam games, and for an app you ask it to watch.",
    shipped: true,
  },
  {
    title: "Your music, one glance away",
    text: "Title, artwork and play controls for whatever Windows is playing, from Spotify to a browser tab. The song's title sits beside the closed island while it plays.",
    shipped: true,
  },
];

export const utilities: Feature[] = [
  { title: "Answer your agents", text: "Allow, Deny or Always allow, pick an answer or type your own, approve a plan. Claude Code and Codex.", shipped: true },
  { title: "See the change first", text: "Edit and Write cards show the file, with removed lines in red and added ones in green.", shipped: true },
  { title: "Know when it's done", text: "A banner names the project, how long it worked, the lines changed and how its last message begins.", shipped: true },
  { title: "Two usage rings", text: "Your Claude 5-hour and weekly limits, and Codex's, in the Agents tab.", shipped: true },
  { title: "Four agents", text: "Claude Code and Codex ask in the island; Gemini CLI and Cursor show working and finished.", shipped: true },
  { title: "Yes or no from the keyboard", text: "Alt+Shift+Y allows and Alt+Shift+N denies, from any app, while a request waits.", shipped: true },
  { title: "A live work map", text: "The files, commands and sites your agent is touching, as it works. It never leaves your PC.", shipped: true },
  { title: "Dictation", text: "Hold Right Ctrl and talk, and the words land where your cursor is.", shipped: true },
  { title: "Out of the way", text: "When a window reaches under it, it shrinks to a line and your clicks go through.", shipped: true },
  { title: "Notifications", text: "Other apps' notifications in the island, with a switch for each app. Click one to open it.", shipped: true },
  { title: "A smarter clipboard", text: "Search, pins and a pause, and the history is encrypted on your PC.", shipped: true },
  { title: "File shelf", text: "Park files on the island and drag them out. Saved screenshots land there too.", shipped: true },
  { title: "Convert files", text: "Images to PNG, JPG or WebP, and Markdown, Word, HTML or text to HTML or PDF, from the shelf.", shipped: true },
  { title: "Your day", text: "Your next meetings, a reminder five minutes before, and a Join button for Zoom, Meet, Teams and Webex.", shipped: true },
  { title: "Calls", text: "Which app has the microphone or camera and for how long, back to it in a click, and a mute.", shipped: true },
];

export const faq: { q: string; a: string }[] = [
  {
    q: `How do I get ${product.name}?`,
    a: `Buy once for ${product.price}. The download link and your license key arrive by email: open ${product.name}, paste the key, and that's it. One key works on up to ${product.maxPcs} PCs.`,
  },
  {
    q: "Is it a subscription?",
    a: "No. You pay once and keep it.",
  },
  {
    q: `Windows says it doesn't recognise ${product.name}. Is that normal?`,
    a: `For now, yes. ${product.name} is new and not yet code-signed, so Windows SmartScreen shows a warning the first time. Choose "More info", then "Run anyway".`,
  },
  {
    q: "What does it change on my PC?",
    a: `Connecting Claude Code adds four hooks to its settings file, six more while the work map is on (it is by default), and a status line for the usage rings unless you already have one. Connecting Codex CLI adds three hooks to its hooks file, Gemini CLI four to its settings file, and Cursor three to its hooks file. A backup of each file is kept, and disconnecting takes it all out again. So does uninstalling, which also asks whether to keep your data. ${product.name} listens only on your own machine.`,
  },
  {
    q: "What data leaves my PC?",
    a: `There is no account. Your license key is checked with the store when you activate it, and again when ${product.name} starts if the last check is a week old. If you turn on synced lyrics (they are off at first), the song's title and artist, and its album and length when known, go to lrclib.net. If you add a calendar, ${product.name} fetches the address you gave it, every 15 minutes. Notes, clipboard history, files on the shelf and settings stay on your PC. Other apps' notifications are shown and not saved.`,
  },
  {
    q: "Which coding agents does it work with?",
    a: `Four. With Claude Code you can allow or deny a request, answer its questions and approve or reject its plans from the island. With Codex CLI you can allow or deny. Gemini CLI and Cursor are watch only: ${product.name} shows when they are working, need you or have finished, because neither offers a way for another app to answer their prompts.`,
  },
  {
    q: "Do I need Claude Code or another agent to use it?",
    a: `No. The music controls, timer, clipboard history, shelf, notes, calendar and the rest work on their own. Every feature has a switch in Settings, so you can turn off what you do not use.`,
  },
  {
    q: "Will it get in the way of fullscreen games and video?",
    a: `No. ${product.name} hides when an app goes fullscreen. A waiting Allow or Deny request still shows, so an agent is never left hanging. You can turn the hiding off in Settings.`,
  },
  {
    q: "Where on the screen does it sit?",
    a: `At the top or the bottom of the display you choose, or anywhere you drag it.`,
  },
  {
    q: "Won't it cover my browser tabs?",
    a: `No. When the window you are working in reaches under the island, ${product.name} shrinks to a thin line at the edge and lets your clicks through to the tabs or title bar below. The line is black, or your accent colour while an agent works. It comes back at full size for a banner or a request, and resting the pointer on the line for half a second opens the panel. Settings, General, "Shrink to a line over windows" turns this off.`,
  },
  {
    q: "Which languages is it in?",
    a: "English, for now.",
  },
];

// The tech specs table on the home page. Each line is something the app's code does today; the file that proves it is
// named beside the line. Change a line in the same commit as the code it describes.
export const specs: { name: string; lines: string[] }[] = [
  {
    name: "Requirements",
    // electron-builder.yml builds one x64 NSIS installer.
    lines: [product.requirements, "64-bit", "No account"],
  },
  {
    name: "Coding agents",
    // bridge.ts, hooks-install.ts, agent-events.ts
    lines: [
      "Claude Code: allow, deny or always allow; answer questions; approve or reject plans",
      "Codex CLI: allow or deny",
      "Gemini CLI and Cursor: working, needs you, finished",
      // agents.ts parseUsage (Claude Code status line); codex-usage.ts (Codex session files)
      "Usage rings for Claude Code and Codex CLI",
      // sound.ts; settings.sound
      "A sound when an agent needs you, with its own volume",
    ],
  },
  {
    name: "Shortcuts",
    // ALLOW_KEY and DENY_KEY in index.ts; registered only while a request waits.
    lines: ["Alt+Shift+Y allows", "Alt+Shift+N denies", "Active only while a request is waiting"],
  },
  {
    name: "Music",
    // winhelper.ps1 reads Windows' media sessions; lyrics.ts
    lines: ["Any app that shows in Windows' media controls", "Shuffle and repeat, in apps that let Windows change them", "Synced lyrics from lrclib.net, off until you turn them on"],
  },
  {
    name: "Monitors",
    // DDC_INPUTS in winhelper.ts
    lines: ["Brightness, contrast and input over DDC/CI", `Inputs: ${monitorInputs.join(", ")}`],
  },
  {
    name: "Clipboard",
    // clipboard-history.ts, settings.ts
    lines: ["Text and images", "5 to 200 items", "Forgotten after a day unless pinned, or the time you set", "Encrypted on disk"],
  },
  {
    name: "Calendar",
    // calendar.ts; refreshed every 900 ticks in index.ts
    lines: ["Any private iCal (.ics) address", "Refreshed every 15 minutes", "Join button for Zoom, Meet, Teams and Webex links"],
  },
  {
    name: "Converter",
    // convertImage and convertDocument in index.ts; documents.ts; shared/convert.ts
    lines: ["Images: PNG, JPG and WebP", "Markdown and Word (.docx) to HTML or PDF", "HTML and text to PDF", "Done on your PC"],
  },
  {
    name: "Links for scripts",
    // links.ts: the five actions a helo:// link can ask for
    lines: [
      `${product.scheme}://banner, timer, awake, shelf and open`,
      "A file is added to the shelf only after you click",
      "Can be switched off",
    ],
  },
  {
    name: "Placement",
    // settings.ts display
    // windowUnder in app/src/shared/face.ts; settings.display.tuck
    lines: ["Top or bottom edge, or dragged anywhere", "Any display", "A thin line while a window is under it", "Hides in fullscreen"],
  },
  {
    name: "Network",
    // bridge.ts listens on 127.0.0.1; config.ts defaultPort
    lines: ["Agents reach it on your own machine only (127.0.0.1)", "Port 47615, or the next free one"],
  },
  {
    name: "License",
    lines: [`${product.price}, once`, `Up to ${product.maxPcs} PCs per key`],
  },
  {
    name: "Language",
    lines: ["English"],
  },
];

// The changelog page. Newest first. A version with no date has not been released.
export const changelog: { version: string; date: string | null; summary: string; groups: { title: string; items: string[] }[] }[] = [
  {
    version: "0.1",
    date: null,
    summary: "The first version.",
    groups: [
      {
        title: "Coding agents",
        items: [
          "Allow, deny or always allow a request from Claude Code, and allow or deny one from Codex CLI, with a click or with Alt+Shift+Y and Alt+Shift+N.",
          "Answer Claude Code's questions by picking or typing, and approve a plan or send it back with feedback.",
          "Edits show the lines they add and remove before you allow them.",
          "A banner when an agent finishes, with how long it took and how many lines changed. Also for Gemini CLI and Cursor.",
          "\"Needs your answer\" stays until you answer, even when another banner passes over it.",
          "Click a banner to go to the terminal or editor the session is in.",
          "The Agents tab shows the file a Claude Code session is editing, and a button that takes you to a session that waits.",
          "A soft sound when an agent needs you, with its own volume. It can stay silent in fullscreen.",
          "The work map: a live drawing of the files, commands and subagents a Claude Code session is using.",
          "Usage rings for Claude Code and Codex CLI.",
        ],
      },
      {
        title: "The island",
        items: [
          `${product.mascot}, a face that follows your pointer and shows what your agents are doing. It sits beside the island, or joined to it as one piece.`,
          "Out of the way: while the window in front reaches under the island, it is a thin line that clicks pass through, in your accent colour while an agent works.",
          "Right-click the island for Settings, Hide and Quit, or to have it step aside for a minute.",
          "Music controls with artwork, shuffle and repeat, the song's title beside the closed island, and synced lyrics if you turn them on.",
          "Notifications from other apps, with a switch for each app. Click one to open the app.",
          "Focus timer with a long break, clipboard history, notes and file shelf.",
          "A converter on the shelf: images to PNG, JPG or WebP, and Markdown, Word, HTML and text files to HTML or PDF.",
          "Calendar from an iCal address, with a Join button for Zoom, Meet, Teams and Webex.",
          `Links for scripts: ${product.scheme}://banner, timer, awake, shelf and open.`,
          "Alerts for finished downloads, Steam games ready to play, battery, low disk space, microphone and camera.",
          "During a call: how long an app has had the microphone or camera, a button to go back to it, and a microphone mute.",
          "Brightness, contrast and input for monitors that support DDC/CI.",
        ],
      },
      {
        title: "Care",
        items: [
          "Clipboard history and the license are encrypted on disk. Clipboard history forgets copies after a day unless you pin them.",
          "Uninstalling removes the hooks from your agents' settings and asks whether to keep your data.",
          "\"Copy diagnostics\" in Settings, for when something does not work.",
        ],
      },
    ],
  },
];
