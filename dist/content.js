// src/shared/match.ts
var normalize = (value) => value.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, " ").trim();
var tokens = (value) => normalize(value).split(" ").filter(Boolean);
var tokenOverlapScore = (query, text) => {
  const q = tokens(query);
  const t = new Set(tokens(text));
  if (q.length === 0) return 0;
  const hits = q.filter((item) => t.has(item)).length;
  return hits / q.length;
};
var subsequenceScore = (query, text) => {
  const q = normalize(query);
  const t = normalize(text);
  if (!q || !t) return 0;
  let qi = 0;
  for (const ch of t) {
    if (ch === q[qi]) qi += 1;
    if (qi >= q.length) break;
  }
  return qi / q.length;
};
var scoreMatch = (query, text) => {
  const exact = normalize(text).includes(normalize(query)) ? 1 : 0;
  const overlap = tokenOverlapScore(query, text);
  const subseq = subsequenceScore(query, text);
  return Math.max(exact, overlap * 0.9, subseq * 0.7);
};

// src/content.ts
var transcriptCache = null;
var readCaptionTracksFromPage = () => new Promise((resolve) => {
  const messageId = `yt-prompt-jump-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const handler = (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data?.source !== "yt-prompt-jump" || data?.id !== messageId) return;
    window.removeEventListener("message", handler);
    resolve(data.tracks ?? []);
  };
  window.addEventListener("message", handler);
  const script = document.createElement("script");
  script.textContent = `(() => {
      const tracks = window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      window.postMessage({ source: "yt-prompt-jump", id: "${messageId}", tracks }, "*");
    })();`;
  document.documentElement.appendChild(script);
  script.remove();
});
var pickBestTrack = (tracks) => {
  if (tracks.length === 0) return null;
  const english = tracks.find(
    (track) => [track.languageCode, track.vssId, track.name?.simpleText].filter(Boolean).join(" ").toLowerCase().includes("en")
  );
  return english ?? tracks[0];
};
var fetchTranscript = async () => {
  const tracks = await readCaptionTracksFromPage();
  const track = pickBestTrack(tracks);
  if (!track?.baseUrl) {
    throw new Error("No transcript found. Try a video with captions.");
  }
  const url = `${track.baseUrl}&fmt=json3`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Unable to fetch transcript.");
  }
  const data = await response.json();
  const items = [];
  for (const event of data.events ?? []) {
    const text = (event.segs ?? []).map((seg) => seg.utf8 ?? "").join("").replace(/\n/g, " ").trim();
    if (!text) continue;
    items.push({
      start: (event.tStartMs ?? 0) / 1e3,
      duration: (event.dDurationMs ?? 0) / 1e3,
      text
    });
  }
  return items;
};
var ensureTranscript = async () => {
  if (!transcriptCache) {
    transcriptCache = fetchTranscript();
  }
  return transcriptCache;
};
var searchTranscript = async (query) => {
  const transcript = await ensureTranscript();
  const scored = transcript.map((item) => ({
    ...item,
    score: scoreMatch(query, item.text)
  })).filter((item) => item.score > 0.2).sort((a, b) => b.score - a.score || a.start - b.start).slice(0, 25);
  return scored;
};
var seekTo = (time) => {
  const video = document.querySelector("video");
  if (!video) return;
  video.currentTime = Math.max(0, time);
  video.play().catch(() => void 0);
};
chrome.runtime.onMessage.addListener(
  (message, _sender, sendResponse) => {
    if (message.type === "search") {
      searchTranscript(message.query).then((results) => {
        const info = results.length ? `Found ${results.length} matches.` : "No matches found.";
        sendResponse({ type: "search", results, info });
      }).catch((error) => {
        sendResponse({ type: "error", message: error?.message ?? "Search failed." });
      });
      return true;
    }
    if (message.type === "seek") {
      seekTo(message.time);
      return false;
    }
    return false;
  }
);
//# sourceMappingURL=content.js.map
