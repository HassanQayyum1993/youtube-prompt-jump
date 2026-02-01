import { scoreMatch } from "./shared/match";
import type { ContentMessage, ContentResponse, SearchResult, TranscriptItem } from "./shared/types";

type CaptionTrack = {
  baseUrl: string;
  name?: { simpleText?: string };
  languageCode?: string;
  vssId?: string;
};

type CaptionResponse = {
  events?: Array<{
    tStartMs?: number;
    dDurationMs?: number;
    segs?: Array<{ utf8?: string }>;
  }>;
};

let transcriptCache: Promise<TranscriptItem[]> | null = null;

const readCaptionTracksFromPage = (): Promise<CaptionTrack[]> =>
  new Promise((resolve) => {
    const messageId = `yt-prompt-jump-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as { source?: string; id?: string; tracks?: CaptionTrack[] };
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

const pickBestTrack = (tracks: CaptionTrack[]) => {
  if (tracks.length === 0) return null;
  const english = tracks.find((track) =>
    [track.languageCode, track.vssId, track.name?.simpleText]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes("en")
  );
  return english ?? tracks[0];
};

const fetchTranscript = async (): Promise<TranscriptItem[]> => {
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

  const data = (await response.json()) as CaptionResponse;
  const items: TranscriptItem[] = [];

  for (const event of data.events ?? []) {
    const text = (event.segs ?? [])
      .map((seg) => seg.utf8 ?? "")
      .join("")
      .replace(/\n/g, " ")
      .trim();

    if (!text) continue;

    items.push({
      start: (event.tStartMs ?? 0) / 1000,
      duration: (event.dDurationMs ?? 0) / 1000,
      text
    });
  }

  return items;
};

const ensureTranscript = async () => {
  if (!transcriptCache) {
    transcriptCache = fetchTranscript();
  }
  return transcriptCache;
};

const searchTranscript = async (query: string): Promise<SearchResult[]> => {
  const transcript = await ensureTranscript();
  const scored = transcript
    .map((item) => ({
      ...item,
      score: scoreMatch(query, item.text)
    }))
    .filter((item) => item.score > 0.2)
    .sort((a, b) => b.score - a.score || a.start - b.start)
    .slice(0, 25);

  return scored;
};

const seekTo = (time: number) => {
  const video = document.querySelector<HTMLVideoElement>("video");
  if (!video) return;
  video.currentTime = Math.max(0, time);
  video.play().catch(() => undefined);
};

chrome.runtime.onMessage.addListener(
  (message: ContentMessage, _sender, sendResponse: (response: ContentResponse) => void) => {
    if (message.type === "search") {
      searchTranscript(message.query)
        .then((results) => {
          const info = results.length
            ? `Found ${results.length} matches.`
            : "No matches found.";
          sendResponse({ type: "search", results, info });
        })
        .catch((error) => {
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
