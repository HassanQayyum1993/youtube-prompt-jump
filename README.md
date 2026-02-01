# YouTube Prompt Jump

Search YouTube transcripts from a prompt and jump to timestamps.

## Setup

1. Install dependencies:
   - `npm install`
2. Build the extension:
   - `npm run build`
3. Load the extension in Chrome:
   - Open `chrome://extensions`
   - Enable Developer mode
   - Click **Load unpacked**
   - Select the `dist` folder

## Usage

1. Open a YouTube video with captions.
2. Click the extension icon.
3. Enter a prompt and select a result to jump.

## Notes

- The extension uses available YouTube captions. Videos without transcripts will show an error.
