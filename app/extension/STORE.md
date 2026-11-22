# Chrome Web Store listing

Upload `app/dist/helo-extension-<version>.zip` at https://chrome.google.com/webstore/devconsole
(a developer account costs a one-time $5). Edge: https://partner.microsoft.com/dashboard/microsoftedge, same zip.

**Name:** Helo for Claude and ChatGPT

**Short description:** Tells the Helo island on your PC when Claude or ChatGPT is answering and when it has finished.

**Description:**
Helo is an island at the top of your Windows screen, with Blink, a small face beside it.
With this extension, Blink thinks while Claude or ChatGPT writes an answer, and if you were
looking at another window, a banner tells you when the answer is done.

It needs the Helo app (https://helo-win.vercel.app). In Helo, open Settings, AI agents,
Claude and ChatGPT in the browser, copy the pairing code and paste it in the extension.

It reads only whether an answer is being written and the chat's title. Nothing from the
conversation is read, and nothing is sent anywhere except to Helo on your own PC (127.0.0.1).

**Category:** Productivity. **Language:** English.

**Single purpose:** Tell the Helo desktop app on the same PC when a Claude or ChatGPT answer starts and ends.

**Permission justifications:**
- `storage`: keeps the pairing code the user pastes in.
- Host `http://127.0.0.1/*`: sends "answering" and "finished" to the Helo app on the user's own PC.
- Content script on claude.ai, chatgpt.com, chat.openai.com: checks whether the page shows its stop button
  (an answer in progress) and reads the page title.
- Remote code: none.

**Data use:** collects no user data. Tick none of the data types; certify the three statements.

**Privacy policy:** https://helo-win.vercel.app/privacy

**Still needed:** at least one screenshot, 1280 x 800 (the island thinking next to a claude.ai tab),
and a small promo tile, 440 x 280.
