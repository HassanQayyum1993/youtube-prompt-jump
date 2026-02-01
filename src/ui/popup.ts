import type { ContentResponse, SearchResult } from "../shared/types";

const queryInput = document.querySelector<HTMLInputElement>("#query");
const searchButton = document.querySelector<HTMLButtonElement>("#search");
const statusEl = document.querySelector<HTMLDivElement>("#status");
const resultsEl = document.querySelector<HTMLUListElement>("#results");
const emptyEl = document.querySelector<HTMLDivElement>("#empty");

if (!queryInput || !searchButton || !statusEl || !resultsEl || !emptyEl) {
  throw new Error("Popup elements missing.");
}

const formatTime = (seconds: number) => {
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const setStatus = (message: string) => {
  statusEl.textContent = message;
};

const clearResults = () => {
  resultsEl.innerHTML = "";
};

const renderResults = (results: SearchResult[]) => {
  clearResults();

  if (results.length === 0) {
    emptyEl.hidden = false;
    return;
  }

  emptyEl.hidden = true;

  for (const item of results) {
    const li = document.createElement("li");
    const time = document.createElement("span");
    time.className = "time";
    time.textContent = formatTime(item.start);

    const text = document.createElement("span");
    text.className = "text";
    text.textContent = item.text;

    const jump = document.createElement("button");
    jump.textContent = "Jump";
    jump.addEventListener("click", () => sendSeek(item.start));

    li.append(time, text, jump);
    resultsEl.appendChild(li);
  }
};

const sendToActiveTab = <T,>(message: unknown): Promise<T> =>
  new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        reject(new Error("No active YouTube tab found."));
        return;
      }

      chrome.tabs.sendMessage(tab.id, message, (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(response as T);
      });
    });
  });

const sendSearch = async (query: string) => {
  setStatus("Searching transcript...");
  searchButton.disabled = true;

  try {
    const response = await sendToActiveTab<ContentResponse>({ type: "search", query });
    if (response.type === "error") {
      setStatus(response.message);
      renderResults([]);
      return;
    }
    setStatus(response.info);
    renderResults(response.results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed.";
    setStatus(message);
    renderResults([]);
  } finally {
    searchButton.disabled = false;
  }
};

const sendSeek = async (time: number) => {
  try {
    await sendToActiveTab({ type: "seek", time });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to jump.";
    setStatus(message);
  }
};

searchButton.addEventListener("click", () => {
  const query = queryInput.value.trim();
  if (!query) {
    setStatus("Type a prompt to search.");
    return;
  }
  sendSearch(query);
});

queryInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    searchButton.click();
  }
});
