import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decode,
  extractVideoId,
  formatTranscript,
  parseCaptions,
  pickTrack,
} from "../extension/transcript.js";

test("extractVideoId", () => {
  assert.equal(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10"), "dQw4w9WgXcQ");
  assert.equal(extractVideoId("https://m.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(extractVideoId("https://www.youtube.com/live/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(extractVideoId("https://evil.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(extractVideoId("https://www.youtube.com/watch?v=short"), null);
  assert.equal(extractVideoId("chrome://newtab"), null);
  assert.equal(extractVideoId(undefined), null);
});

test("pickTrack prefers human English, accepts region variants, falls back to Hindi", () => {
  assert.equal(
    pickTrack([{ languageCode: "en", kind: "asr" }, { languageCode: "en-GB" }]).languageCode,
    "en-GB",
  );
  assert.equal(
    pickTrack([{ languageCode: "hi" }, { languageCode: "en", kind: "asr" }]).kind,
    "asr",
  );
  assert.equal(pickTrack([{ languageCode: "de" }, { languageCode: "hi" }]).languageCode, "hi");
  assert.equal(pickTrack([{ languageCode: "de" }]), null);
  assert.equal(pickTrack(), null);
});

test("parseCaptions srv3 with spans and newlines", () => {
  const xml = `<timedtext format="3"><body><p t="1360" d="1680">[♪♪♪]</p>
<p t="22640" d="4320" w="1"><s>You</s><s t="200"> know</s> the
rules &amp;amp; We&#39;re</p><p t="5000" d="1"> </p></body></timedtext>`;
  assert.deepEqual(parseCaptions(xml), [
    { start: 1.36, text: "[♪♪♪]" },
    { start: 22.64, text: "You know the rules &amp; We're" },
  ]);
});

test("parseCaptions classic double-escaped format", () => {
  const xml = `<transcript><text start="65.5" dur="2">it&amp;#39;s &amp;quot;ok&amp;quot;</text></transcript>`;
  assert.deepEqual(parseCaptions(xml), [{ start: 65.5, text: `it's "ok"` }]);
  assert.deepEqual(parseCaptions("garbage"), []);
});

test("decode and format", () => {
  assert.equal(decode("&#x1F600;&#65;&bogus;&#99999999;"), "😀A&bogus;&#99999999;");
  assert.equal(
    formatTranscript([
      { start: 3725.9, text: "hi" },
      { start: 0, text: "a" },
    ]),
    "62:05 - hi\n0:00 - a",
  );
});
