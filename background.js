// Universal Chat Log Export - Background Script

const config = {
  debug: true,
  domains: [
    "chat.openai.com",
    "chatgpt.com",
    "claude.ai",
    "anthropic.com",
    "gemini.google.com",
  ],
};

chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    sendResponse({ success: false, error: "External requests not allowed" });
    return true;
  },
);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "heartbeat") {
    sendResponse({ alive: true });
    return true;
  }

  switch (request.action) {
    case "directDownload":
      // Used for JSON and Base64 blobs
      try {
        chrome.downloads.download(
          {
            url: request.url,
            filename: request.filename,
            saveAs: false,
          },
          (downloadId) => {
            if (chrome.runtime.lastError) {
              sendResponse({
                success: false,
                error: chrome.runtime.lastError.message,
              });
            } else {
              sendResponse({ success: true, downloadId });
            }
          },
        );
        return true;
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;

    case "downloadMedia":
      // Legacy downloader (ChatGPT)
      if (request.url && request.filename) {
        downloadMedia(request.url, request.token, request.filename)
          .then((result) => sendResponse(result))
          .catch((err) => sendResponse({ success: false, error: err.message }));
        return true;
      }
      break;

    case "fetchBlobBase64":
      // THE FIX: Fetch remote URL and return as Base64 to content script
      // This bypasses CORS because the Background Script has host permissions
      fetch(request.url)
        .then((response) => response.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () =>
            sendResponse({ success: true, data: reader.result });
          reader.readAsDataURL(blob);
        })
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
  }
  return false;
});

// Specialized downloader (kept for ChatGPT compatibility)
async function downloadMedia(url, token, filename) {
  try {
    let blob = null;
    let urlsToTry = [url];

    if (url.includes("file-service://")) {
      const id = url.split("file-service://")[1];
      urlsToTry = [`https://chatgpt.com/backend-api/files/${id}/download`];
    }

    for (const u of urlsToTry) {
      try {
        const headers = { "Cache-Control": "no-cache" };
        if (
          token &&
          token !== "dummy" &&
          !u.includes("googleusercontent") &&
          !u.includes("oaiusercontent")
        ) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const resp = await fetch(u, { headers });
        if (resp.ok) {
          blob = await resp.blob();
          break;
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (!blob) return await downloadFromUnsafeUrl(urlsToTry[0], filename);

    const blobUrl = URL.createObjectURL(blob);
    return new Promise((resolve) => {
      chrome.downloads.download(
        {
          url: blobUrl,
          filename: filename,
          saveAs: false,
        },
        (id) => {
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
          if (chrome.runtime.lastError)
            resolve({
              success: false,
              error: chrome.runtime.lastError.message,
            });
          else resolve({ success: true, filename });
        },
      );
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function downloadFromUnsafeUrl(url, filename) {
  return new Promise((resolve) => {
    chrome.downloads.download(
      {
        url: url,
        filename: filename,
        saveAs: false,
      },
      (id) => {
        if (chrome.runtime.lastError)
          resolve({ success: false, error: chrome.runtime.lastError.message });
        else resolve({ success: true, filename });
      },
    );
  });
}
