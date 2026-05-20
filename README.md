# Sgelo

> Italian for "thaw / defrost" — it unfreezes a frozen input.

A tiny Chrome extension that stops ChatGPT and Claude from freezing the
page for **20-90 seconds** the first time you start a CJK (Chinese /
Japanese / Korean) IME composition on macOS.

If you've ever opened a fresh `chatgpt.com` tab, switched to Pinyin /
Wubi / Cangjie / Kana, started typing — and watched the whole tab go
unresponsive for half a minute while the spinning beachball mocks you —
this fixes it.

## TL;DR

- Symptom: macOS Chrome + ChatGPT/Claude + first CJK IME keystroke =
  20-90s main-thread freeze.
- Root cause: the page constructs an `RTCPeerConnection` very early
  (voice-mode warm-up and/or anti-bot fingerprinting). On macOS, that
  triggers synchronous WebRTC init — audio device enumeration + mDNS
  ICE candidate gathering — on the main thread. The IME's
  `compositionstart` path happens to fire it.
- Fix: replace `RTCPeerConnection` with a no-op stub before any site
  code runs. Text chat works normally; voice mode does not.

Profile evidence (captured with [sotto-debugger]): `RTCPeerConnection`
appearing as the #1 self-time function with 9.3s during a 23s freeze
(and 86s during a worse one). With the stub installed, the freeze
disappears entirely.

[sotto-debugger]: https://github.com/MoonQiu1342/sotto-debugger

## Who needs this

You need it if **all** of the following are true:

- You're on macOS.
- You use Chrome (or a Chromium browser — Edge, Brave, Arc, etc.).
- You type Chinese / Japanese / Korean with a system IME.
- You use chatgpt.com, chat.openai.com, or claude.ai.

If you only type English, you will never hit this bug and don't need
the extension. If you're on Windows or Linux, the same code path
doesn't seem to stall — reports welcome.

## Install

Not on the Chrome Web Store (it's a personal patch, not a product).
Load it unpacked:

1. Clone or download this repo.
2. Open `chrome://extensions/`.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and select this folder.
5. Reload any open ChatGPT / Claude tabs.

## Verify it's working

Open DevTools console on chatgpt.com or claude.ai. You should see:

```
[ime-unfreeze] installed on chatgpt.com
```

The first few times the site tries to construct an
`RTCPeerConnection`, you'll also see:

```
[ime-unfreeze] RTCPeerConnection stubbed (#1) on chatgpt.com — disable this extension if you need voice mode
```

That warning is the extension doing its job. After three stubs it goes
quiet to avoid spamming the console.

## How it works

`block.js` runs in the page's MAIN world at `document_start` — before
any site bundle has had a chance to capture the real constructor — and
replaces `window.RTCPeerConnection` and `window.webkitRTCPeerConnection`
with a stub that:

- Exposes the full `RTCPeerConnection` API surface, so feature
  detection and `instanceof` checks still pass. (Throwing or returning
  `undefined` crashes React error boundaries on both sites.)
- Returns rejected promises from `createOffer` / `setLocalDescription`
  / `addIceCandidate` / etc.
- Returns harmless empty values from `getSenders` / `getStats` /
  `createDataChannel` / etc.
- Preserves the original prototype and static `generateCertificate`,
  again so any feature-detect doesn't blow up.

Result: the warm-up code thinks it constructed a peer connection,
silently fails to do anything useful with it, and never triggers the
native WebRTC init that was blocking the main thread.

## Limitations / trade-offs

- **Voice mode is broken** while the extension is enabled. ChatGPT
  Advanced Voice Mode and any future voice features on Claude rely on
  `RTCPeerConnection`. To use voice, disable the extension (toggle off
  in `chrome://extensions/`) and reload the tab.
- **Scope is narrow on purpose**: only `chatgpt.com`,
  `chat.openai.com`, and `claude.ai`. Other sites are untouched. If
  you hit the same symptom elsewhere, add the host to
  `content_scripts[0].matches` in `manifest.json`.
- **Root cause is empirical, not fully reverse-engineered.** The stub
  fix is confirmed; the exact caller (site voice warm-up vs.
  Cloudflare bot-management fingerprint) hasn't been traced all the
  way to its origin. Both sites are behind Cloudflare.

## Files

- `manifest.json` — MV3 manifest. `world: "MAIN"`,
  `run_at: "document_start"`, `all_frames: true`.
- `block.js` — the stub installer (~160 lines, no dependencies).
- `icon.svg` / `icons/` — toolbar icon.

## Releases

See [Releases](https://github.com/MoonQiu1342/ime-unfreeze/releases)
for version history.

## License

MIT. Use, fork, modify freely.
