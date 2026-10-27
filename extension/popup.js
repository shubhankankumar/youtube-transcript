import { extractVideoId } from "./transcript.js";

const btn = document.getElementById("copyBtn");
const status = document.getElementById("status");
const LABEL = btn.textContent;

function setStatus(text, className) {
  status.textContent = text;
  status.className = className;
}

btn.addEventListener("click", async () => {
  btn.disabled = true;
  btn.textContent = "Fetching...";
  setStatus("", "");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const videoId = extractVideoId(tab?.url);
    if (!videoId) throw new Error("Go to a YouTube video first");

    const resp = await chrome.runtime.sendMessage({ action: "getTranscript", videoId });
    if (!resp?.text) throw new Error(resp?.error || "Failed to fetch transcript");
    await navigator.clipboard.writeText(resp.text);

    setStatus("Copied!", "success");
    btn.textContent = "Copied";
    setTimeout(() => window.close(), 1500);
  } catch (err) {
    setStatus(err.message, "error");
    btn.disabled = false;
    btn.textContent = LABEL;
  }
});
