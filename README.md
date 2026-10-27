# Copy Transcript

Chrome extension (Manifest V3) that copies a YouTube video's transcript to the clipboard as `m:ss - text` lines.

- **Popup:** click the toolbar icon, then **Copy Transcript**.
- **Shortcut:** `Ctrl+Shift+Q` (`Cmd+Shift+Q` on Mac) copies silently and shows a toast only on error.

It picks English captions first (human-made before auto-generated, any region such as `en-GB`), then Hindi.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select the `extension/` folder.

## How it works

The service worker asks YouTube's InnerTube player API (as the Android client) for caption tracks, then downloads and parses the timedtext XML. The User-Agent rewrites are DNR session rules scoped to the service worker's own requests (`tabIds: [-1]`), so YouTube in your tabs is never affected.

```
extension/
  manifest.json
  background.js   service worker: fetch, header rules, shortcut
  popup.html/js   toolbar popup
  transcript.js   pure parsing/formatting (shared + unit-tested)
  icons/
test/             node --test unit tests
```

## Test

```
npm test
```

Requires Node 18 or newer. There are no dependencies. Code is formatted with Prettier (`npx prettier --check .`).
