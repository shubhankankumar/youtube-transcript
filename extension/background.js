import { extractVideoId, formatTranscript, parseCaptions, pickTrack } from "./transcript.js";

const PLAYER_URL = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
const ANDROID_VERSION = "20.10.38";
const ANDROID_UA = `com.google.android.youtube/${ANDROID_VERSION} (Linux; U; Android 14)`;
const TIMEDTEXT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)";

// YouTube only serves captions to these requests with the headers below. The rules are scoped to
// tabIds [-1] (this service worker) so YouTube's own requests in the user's tabs are never touched.
const rulesReady = chrome.declarativeNetRequest.updateSessionRules({
  removeRuleIds: [1, 2],
  addRules: [
    headerRule(1, "youtubei/v1/player", ANDROID_UA),
    headerRule(2, "timedtext", TIMEDTEXT_UA),
  ],
});

function headerRule(id, urlFilter, userAgent) {
  const removed = ["Sec-Fetch-Site", "Sec-Fetch-Mode", "Sec-Fetch-Dest", "Origin"];
  return {
    id,
    action: {
      type: "modifyHeaders",
      requestHeaders: [
        { header: "User-Agent", operation: "set", value: userAgent },
        ...removed.map((header) => ({ header, operation: "remove" })),
      ],
    },
    condition: {
      urlFilter,
      requestDomains: ["youtube.com"],
      tabIds: [chrome.tabs.TAB_ID_NONE],
      resourceTypes: ["xmlhttprequest", "other"],
    },
  };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.action !== "getTranscript" || sender.id !== chrome.runtime.id) return;
  getTranscript(msg.videoId)
    .then((text) => sendResponse({ text }))
    .catch((err) => sendResponse({ error: err.message }));
  return true;
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "copy-transcript" || !tab?.id) return;
  try {
    const videoId = extractVideoId(tab.url);
    if (!videoId) throw new Error("Not on a YouTube video page");
    const [{ result: copied } = {}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: copyInPage,
      args: [await getTranscript(videoId)],
    });
    if (!copied) throw new Error("Clipboard write was blocked. Click the page and try again.");
  } catch (err) {
    chrome.scripting
      .executeScript({ target: { tabId: tab.id }, func: toastInPage, args: [err.message] })
      .catch(() => {});
  }
});

async function getTranscript(videoId) {
  if (!/^[\w-]{11}$/.test(videoId)) throw new Error("Invalid video ID");
  await rulesReady;

  const resp = await fetch(PLAYER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context: { client: { clientName: "ANDROID", clientVersion: ANDROID_VERSION } },
      videoId,
    }),
  });
  if (!resp.ok) throw new Error(`YouTube API returned ${resp.status}`);
  const data = await resp.json();

  const tracks = data.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks?.length) {
    throw new Error(data.playabilityStatus?.reason || "No captions found for this video");
  }
  const track = pickTrack(tracks);
  if (!track) throw new Error("No English or Hindi captions available for this video");

  const url = new URL(track.baseUrl);
  if (url.protocol !== "https:" || url.hostname !== "www.youtube.com") {
    throw new Error("Unexpected caption URL");
  }

  const segments = parseCaptions(await fetchCaptionXml(url));
  if (!segments.length) throw new Error("Could not parse captions");
  return formatTranscript(segments);
}

// Retries network errors, 5xx and empty bodies with 1s/2s backoff; 4xx fails fast.
async function fetchCaptionXml(url) {
  for (let attempt = 1; ; attempt++) {
    const resp = await fetch(url).catch(() => null);
    const failure = !resp
      ? "Network error fetching captions"
      : resp.ok
        ? "Empty caption response"
        : `Caption fetch returned ${resp.status}`;
    if (resp?.status >= 400 && resp.status < 500) throw new Error(failure);

    const xml = resp?.ok ? await resp.text().catch(() => "") : "";
    if (xml.length > 10) return xml;
    if (attempt === 3) throw new Error(failure);
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
  }
}

// Injected into the page: runs there, not in the service worker.
async function copyInPage(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {}
  const el = document.createElement("textarea");
  el.value = text;
  el.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(el);
  el.select();
  const ok = document.execCommand("copy");
  el.remove();
  return ok;
}

// Injected into the page: runs there, not in the service worker.
function toastInPage(msg) {
  document.getElementById("__yt_transcript_error")?.remove();
  const toast = document.createElement("div");
  toast.id = "__yt_transcript_error";
  toast.setAttribute("role", "alert");
  toast.textContent = "Transcript: " + msg;
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    maxWidth: "350px",
    padding: "12px 16px",
    borderRadius: "8px",
    background: "#c00",
    color: "#fff",
    font: "14px sans-serif",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
    zIndex: "999999",
    opacity: "0",
    transition: "opacity 0.3s",
  });
  document.body.appendChild(toast);
  requestAnimationFrame(() => (toast.style.opacity = "1"));
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
