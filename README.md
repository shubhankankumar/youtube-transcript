# Copy Transcript

A small Chrome extension that copies the transcript of the YouTube video you're watching straight to your clipboard. Every line starts with its timestamp (like `4:07`) followed by what was said, so you can paste it into notes, a doc or a chatbot and still know where each part came from.

## Install

It isn't on the Chrome Web Store, so you load it yourself.

1. Download or clone this repo.
2. Open `chrome://extensions` and switch on **Developer mode** in the top right.
3. Click **Load unpacked** and pick the `extension` folder.

You need Chrome 116 or newer.

## Usage

There are two ways.

1. Click the extension icon and press **Copy Transcript**.
2. Press `Ctrl+Shift+Q` on the video page (`Cmd+Shift+Q` on a Mac). This one copies silently. You only see a message if something went wrong.

It works on normal videos, Shorts and live replays.

## Which captions it picks

English first, any region (en, en-GB, en-US and so on). If a video has both human-written and auto-generated English captions, it takes the human ones. If there's no English at all it falls back to Hindi. If neither exists it tells you so instead of copying nothing.

## How it works

The popup and the shortcut both hand the video ID to the service worker. The service worker asks YouTube's InnerTube player API for the list of caption tracks, pretending to be the Android YouTube app because that client returns caption URLs reliably. It then downloads the timedtext XML, parses it and copies the result.

To pretend to be the Android app it has to change the User-Agent header. It does that with declarativeNetRequest session rules that only apply to requests made by the service worker itself (`tabIds: [-1]`). YouTube in your normal tabs never sees a changed header.

The parser handles both caption formats YouTube serves: the newer srv3 one and the older classic one, which is double-escaped. HTML entities are decoded in a single pass so something like `&amp;lt;` turns into `&lt;` and not `<`.

Server errors from YouTube are retried, up to three attempts in total. Errors you might see:

1. "Not on a YouTube video page"
2. "No English or Hindi captions available for this video"
3. "Clipboard write was blocked. Click the page and try again." This happens when the page doesn't have focus.

## Files

```
extension/
  manifest.json
  background.js    service worker, API calls, header rules, shortcut
  popup.html       the toolbar popup
  popup.js
  transcript.js    parsing and formatting, no chrome APIs so it can be tested in Node
  icons/
test/              unit tests
```

## Permissions

`activeTab` and `scripting` so it can read the current tab and show an error message on the page. `declarativeNetRequest` for the header rule above. Host access to `youtube.com` only.

## Development

```
npm test
```

You need Node 18 or newer. There are no dependencies to install. Code is formatted with Prettier. Run `npx prettier --check .` before committing.
