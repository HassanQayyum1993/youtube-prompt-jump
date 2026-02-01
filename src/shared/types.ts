export type TranscriptItem = {
  start: number;
  duration: number;
  text: string;
};

export type SearchResult = TranscriptItem & {
  score: number;
};

export type ContentMessage =
  | { type: "search"; query: string }
  | { type: "seek"; time: number };

export type ContentResponse =
  | { type: "search"; results: SearchResult[]; info: string }
  | { type: "error"; message: string };
