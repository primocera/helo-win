// One place for everything the site says about the product.
// Keep it in step with the app's config: name, price, trial, checkout link.
export const product = {
  name: "Helo", // placeholder until the final name is chosen
  mascot: "Blink",
  tagline: "The island for your Windows screen",
  price: "$9.99",
  trialDays: 7,
  maxPcs: 3,
  buyUrl: "https://example.com/buy", // checkout page (not set up yet)
  requirements: "Windows 10 or 11",
};

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
    text: "When Claude Code asks to run a command, the island opens with what it wants to do. Allow or deny with a click, or Ctrl+Alt+Y and Ctrl+Alt+N. No hunting for the right terminal.",
    shipped: true,
  },
  {
    title: "Know the moment it's done",
    text: "A banner when your agent finishes or needs an answer. The same for downloads and Steam games, and for any app you ask it to watch.",
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
  { title: "Clipboard history", text: "The last things you copied, one click to copy again.", shipped: true },
  { title: "Notes", text: "A scratchpad that is always one hover away.", shipped: true },
  { title: "File shelf", text: "Park files on the island, drag them out where you need them.", shipped: true },
  { title: "Keep awake", text: "Stop the PC from sleeping while something long is running.", shipped: true },
  { title: "Battery alerts", text: "Low, charging and full, without a pop-up in the corner.", shipped: false },
  { title: "Microphone light", text: "See when an app is listening.", shipped: true },
  { title: "Volume", text: "Volume changes show in the island.", shipped: true },
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
    a: `Connecting Claude Code adds three hooks to your Claude Code settings file and keeps a backup. Disconnecting removes them. ${product.name} listens only on your own machine.`,
  },
  {
    q: "What data leaves my PC?",
    a: "Your license key is checked with the store when you activate it and now and then afterwards. Notes, clipboard history and settings stay on your PC. There is no account.",
  },
];
