import { extractVideoId } from "./transcript.js";

const btn = document.getElementById("copyBtn");
const status = document.getElementById("status");
const LABEL = btn.textContent;

function setStatus(text, className) {
  status.textContent = text;
  status.className = className;
}

const request = (videoId) => chrome.runtime.sendMessage({ action: "getTranscript", videoId });
const videoIdReady = chrome.tabs
  .query({ active: true, currentWindow: true })
  .then(([tab]) => extractVideoId(tab?.url));
// Start fetching the moment the popup opens, so by the time you click it is usually done.
let pending = videoIdReady.then((id) => id && request(id)).catch(() => null);

btn.addEventListener("click", async () => {
  btn.disabled = true;
  btn.textContent = "Fetching...";
  setStatus("", "");
  try {
    const videoId = await videoIdReady;
    if (!videoId) throw new Error("Go to a YouTube video first");

    const resp = (await pending) ?? (await request(videoId));
    if (!resp?.text) throw new Error(resp?.error || "Failed to fetch transcript");
    await navigator.clipboard.writeText(resp.text);

    setStatus("Copied!", "success");
    btn.textContent = "Copied";
    setTimeout(() => window.close(), 800);
  } catch (err) {
    pending = null; // retry fresh on the next click (the worker drops failed requests from its cache)
    setStatus(err.message, "error");
    btn.disabled = false;
    btn.textContent = LABEL;
  }
});
