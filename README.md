# IME Unfreeze (ChatGPT / Claude)

Tiny Chrome extension that stops ChatGPT and Claude from freezing for
20-90 seconds the first time you type CJK input via an IME on macOS.

## What it does

Replaces `window.RTCPeerConnection` (and `webkitRTCPeerConnection`) with a
no-op stub on `chatgpt.com`, `chat.openai.com`, and `claude.ai`. Runs in
the MAIN page world at `document_start` so the site bundle sees the stub
instead of the real constructor.

## Why

Profile-confirmed: a 23-second freeze on first Chinese IME composition
showed `RTCPeerConnection` 9.3s self-time as the #1 hot function (captured
by `sotto-debugger`). Constructing `RTCPeerConnection` on macOS Chrome
triggers synchronous WebRTC stack init (audio device enumeration + mDNS
ICE candidate gathering) that blocks the main thread. Either the site's
own voice warm-up or Cloudflare's anti-bot fingerprinting fires it from
the `compositionstart` event path — CJK IME users always hit it; English
typists never do.

## Install

1. `chrome://extensions/` → enable Developer mode
2. Load unpacked → select this folder
3. Reload ChatGPT / Claude tabs

Verify in DevTools console: `[ime-unfreeze] installed on chatgpt.com`.
When the stub fires you'll also see `[ime-unfreeze] RTCPeerConnection
stubbed (#N) on …`.

## Disable for voice mode

ChatGPT Advanced Voice Mode uses `RTCPeerConnection`. To use voice, toggle
this extension off in `chrome://extensions/` and reload the tab.

## Files

- `manifest.json` — MV3, content_scripts with `world: "MAIN"`,
  `run_at: "document_start"`, `all_frames: true`
- `block.js` — installs the stub, preserves prototype + static methods
  for `instanceof` and feature detection

## Releases

See the [Releases page](https://github.com/MoonQiu1342/ime-unfreeze/releases)
for version history.
