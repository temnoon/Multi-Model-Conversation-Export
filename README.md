# Multi-Model-Conversation-Export (Beta v0.8)

A privacy-focused Chrome extension that lets you export your AI conversation logs from **ChatGPT**, **Claude**, and **Gemini** into clean, organized Zip archives.

Unlike standard exports that give you a messy dump of *everything*, this tool lets you download **individual conversations** one by one, preserving the structure, metadata, and media links.

## Features

### 🌟 Universal Support
Works on the three major AI platforms:
- **ChatGPT:** Full support for text, user-uploaded images, and DALL-E generations.
- **Claude:** High-fidelity text export with metadata (Note: Media downloading is currently disabled for stability).
- **Gemini:** Clean text export that filters out sidebar/UI noise (Note: Media downloading is currently disabled for stability).

### 📦 Smart ZIP Archiving
Instead of a single JSON file, downloads are packaged as a `.zip` file containing:
- A folder named after your conversation title (on ChatGPT and Gemini).
- `conversation.json`: A structured log of every message, timestamp, and model used.
- `media/`: A dedicated folder containing downloaded images (ChatGPT only).

### 🔒 Privacy First
- **100% Local:** All processing happens directly in your browser.
- **No Analytics:** We do not track your usage or collect data.
- **Secure:** Your access tokens are stored in your browser's local storage and used *only* to fetch the specific conversation you requested.

## Usage

1.  **Install the Extension** (See installation steps below).
2.  Navigate to a chat page on **ChatGPT**, **Claude**, or **Gemini**.
3.  Look for the **Floating Download Button** in the bottom-right corner of the screen.
    * *Note:* On Claude, the button appears only when you are inside a specific chat.
4.  Click the button.
5.  Wait for the "Done!" status message, then check your downloads folder for the Zip file.

## Known Limitations (Beta 0.8)

* **Audio Files (ChatGPT Voice Mode):** Audio clips are currently **skipped** to prevent download errors. The references to these files are still preserved in the `conversation.json` for archival purposes.
* **Claude & Gemini Media:** Currently, this version extracts text only for Claude and Gemini. Image downloading for these platforms is in development and disabled to ensure export stability.
* **"Sediment" Links:** You may see `sediment://` links in the JSON. These are internal OpenAI references. We attempt to resolve these to real files where possible (e.g., for DALL-E images), but some internal assets may remain as references.

## Installation (Developer Mode)

Since this is a Beta release, you can load it as an unpacked extension:

1.  Download or clone this repository: https://github.com/temnoon/Multi-Model-Conversation-Export
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Toggle **"Developer mode"** in the top-right corner.
4.  Click **"Load unpacked"**.
5.  Select the folder containing this `manifest.json`.

## Troubleshooting

* **Button not appearing?** Try refreshing the page. The script needs a moment to detect the chat container.
* **Download stuck?** If a specific file fails to download due to permission errors, the extension will skip it and generate a text file in the `media/` folder explaining the error, ensuring you still get the rest of your data.

## License

This project is open-source. Feel free to fork, modify, and improve! GPL-2.0 license
