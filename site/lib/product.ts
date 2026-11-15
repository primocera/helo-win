// One place for everything the site says about the product.
// Keep it in step with the app's config: name, price, trial, checkout link (app/src/main/config.ts),
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
  // How many features have their own on/off switch in Settings: the keys of DEFAULT_FEATURES in
  // app/src/main/settings.ts (agents, map, usage, mascot, media, lyrics, timer, clipboard, notes, shelf, keepAwake,
  // battery, privacy, hud, displays, calendar, converter, downloads, steam, watchApp). Recount when that list changes.
  featureSwitches: 20,
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
    text: "When Claude Code or Codex CLI asks to run something, the island opens with what it wants to do. Allow or deny with a click, or with Ctrl+Alt+Y and Ctrl+Alt+N. Claude Code's questions and plans can be answered there too, and its edits show the lines they change.",
    shipped: true,
  },
  {
    title: "Know the moment it's done",
    text: "A banner when your agent finishes or needs an answer. The same for browser downloads and Steam games, and for an app you ask it to watch.",
    shipped: true,
  },
  {
    title: "Your music, one glance away",
    text: "Title, artwork and play controls for whatever Windows is playing, from Spotify to a browser tab.",
    shipped: true,
  },
];

export const utilities: Feature[] = [
  { title: "Focus timer", text: "Work and break sessions that count down in the island.", shipped: true },
  { title: "Clipboard history", text: "Text and images you copied, one click to copy again.", shipped: true },
  { title: "Notes", text: "A scratchpad that saves as you type.", shipped: true },
  { title: "File shelf", text: "Park files on the island and drag them out where you need them. Saved screenshots land there too.", shipped: true },
  { title: "Image converter", text: "Turn an image on the shelf into PNG, JPG or WebP.", shipped: true },
  { title: "Calendar", text: "Your next events from a private iCal address, with a reminder five minutes before.", shipped: true },
  { title: "Finished alerts", text: "Told when a download ends, a Steam game is ready, or an app you picked goes quiet.", shipped: true },
  { title: "Keep awake", text: "One switch stops the screen from sleeping while something long runs.", shipped: true },
  { title: "Battery alerts", text: "Plugged in, unplugged, full and low, shown in the island.", shipped: true },
  { title: "Microphone and camera", text: "See when an app starts using either one.", shipped: true },
  { title: "Volume", text: "Volume changes show in the island, with a slider to set it.", shipped: true },
  { title: "Startup apps", text: "See what opens when you sign in to Windows, and switch your own apps on or off.", shipped: true },
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
    q: "Can I try it first?",
    a: `Yes. ${product.name} runs free for ${product.trialDays} days, with everything unlocked.`,
  },
  {
    q: `Windows says it doesn't recognise ${product.name}. Is that normal?`,
    a: `For now, yes. ${product.name} is new and not yet code-signed, so Windows SmartScreen shows a warning the first time. Choose "More info", then "Run anyway".`,
  },
  {
    q: "What does it change on my PC?",
    a: `Connecting Claude Code adds four hooks to its settings file, six more while the work map is on (it is by default), and a status line for the usage rings unless you already have one. Connecting Codex CLI adds three hooks to its hooks file. A backup of each file is kept, and disconnecting takes it all out again. Uninstalling does not do that yet, so disconnect first. ${product.name} listens only on your own machine.`,
  },
  {
    q: "What data leaves my PC?",
    a: `There is no account. Your license key is checked with the store when you activate it, and again when ${product.name} starts if the last check is a week old. If you turn on synced lyrics (they are off at first), the song's title and artist, and its album and length when known, go to lrclib.net. If you add a calendar, ${product.name} fetches the address you gave it, every 15 minutes. Notes, clipboard history, files on the shelf and settings stay on your PC.`,
  },
];
