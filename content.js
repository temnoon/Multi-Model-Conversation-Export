// Universal Chat Log Export - Content Script

function getProvider() {
  const host = window.location.hostname;
  if (host.includes("claude.ai")) return "claude";
  if (host.includes("gemini.google.com")) return "gemini";
  if (host.includes("openai") || host.includes("chatgpt")) return "chatgpt";
  return null;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  chrome.runtime.sendMessage({
    action: "directDownload",
    url: url,
    filename: filename,
  });
}

// --- ZIP LOGIC ---

async function createAndDownloadZip(data, statusCallback, authToken = null) {
  if (!window.JSZip) {
    alert(
      "JSZip library is missing. Please ensure lib/jszip.min.js is loaded.",
    );
    return;
  }

  const zip = new JSZip();
  const safeTitle = (data.title || "Untitled Chat")
    .replace(/[^a-z0-9_\-\s\.]/gi, "_")
    .trim();
  const folderName = safeTitle.substring(0, 64);

  const root = zip.folder(folderName);

  statusCallback("Adding conversation.json...");
  root.file("conversation.json", JSON.stringify(data, null, 2));

  const mediaItems = data.media || [];

  if (mediaItems.length > 0) {
    const mediaFolder = root.folder("media");
    statusCallback(`Downloading ${mediaItems.length} media files...`);
    const BATCH_SIZE = 5;

    for (let i = 0; i < mediaItems.length; i += BATCH_SIZE) {
      const batch = mediaItems.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (item) => {
          try {
            statusCallback(`Fetching: ${item.filename}`);

            let blob;
            const forceBackground =
              item.isRemote ||
              item.url.includes("googleusercontent.com") ||
              item.url.includes("anthropic.com");

            // 1. Direct Fetch
            if (!forceBackground && item.url.startsWith("http")) {
              try {
                const headers = {};
                if (authToken && item.url.includes("chatgpt.com/backend-api")) {
                  headers["Authorization"] = `Bearer ${authToken}`;
                }

                let response = await fetch(item.url, { headers });

                // HANDLE REDIRECT / 2-STEP DOWNLOAD
                // ChatGPT sometimes returns 200 OK with a JSON body pointing to the real file
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                  // Clone to read text without consuming blob for later
                  const clone = response.clone();
                  const json = await clone.json();

                  // Case A: Success with redirect URL
                  if (json.status === "success" && json.download_url) {
                    // Fetch the REAL url
                    response = await fetch(json.download_url);
                  }
                  // Case B: Error (e.g. file_not_found)
                  else if (json.status === "error" || json.detail) {
                    throw new Error(
                      `API Error: ${json.detail || json.error_code}`,
                    );
                  }
                }

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                blob = await response.blob();
              } catch (e) {
                console.warn(
                  `Direct fetch failed/rejected for ${item.filename}: ${e.message}`,
                );
              }
            }

            // 2. Background Fetch (Fallback)
            if (!blob && item.url.startsWith("http")) {
              const base64Data = await new Promise((resolve) => {
                chrome.runtime.sendMessage(
                  { action: "fetchBlobBase64", url: item.url },
                  (response) => {
                    resolve(
                      response && response.success ? response.data : null,
                    );
                  },
                );
              });
              if (base64Data) {
                const res = await fetch(base64Data);
                blob = await res.blob();
              }
            }

            // 3. VALIDATION (Stop .bin errors)
            if (blob) {
              // Peek at file content if small/suspicious
              if (blob.size < 2000) {
                const text = await blob.text();
                // Check for JSON error signature
                if (
                  text.startsWith("{") &&
                  (text.includes('"error"') || text.includes('"detail"'))
                ) {
                  console.error(
                    `Skipping ${item.filename}: File contains Error JSON.`,
                  );
                  return; // ABORT: Do not save this file
                }
              }

              mediaFolder.file(item.filename, blob);
            }
          } catch (e) {
            console.error(`Error processing ${item.filename}:`, e);
          }
        }),
      );
    }
  } else {
    statusCallback("No media found. Creating text-only archive...");
  }

  statusCallback("Generating Zip file...");
  const content = await zip.generateAsync({ type: "blob" });

  statusCallback("Saving...");
  downloadBlob(content, `${folderName}.zip`);
  statusCallback("Done!");
}

async function handleExportClick() {
  const provider = getProvider();

  const statusDiv = document.createElement("div");
  statusDiv.style.cssText =
    "position:fixed;bottom:80px;right:20px;background:#1e1e1e;color:#e3e3e3;padding:15px;border-radius:8px;z-index:10000;font-family:sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.5);border:1px solid #444;font-size:14px;max-width:300px;";
  statusDiv.textContent = "Initializing...";
  document.body.appendChild(statusDiv);

  const updateStatus = (msg) => {
    statusDiv.textContent = msg;
  };

  try {
    let exportData = null;
    let authToken = null;

    if (provider === "gemini") {
      if (!window.GeminiHandler)
        throw new Error("Gemini Handler module not loaded");
      exportData = await window.GeminiHandler.extract(updateStatus);
    } else if (provider === "chatgpt") {
      if (!window.ChatGPTHandler)
        throw new Error("ChatGPT Handler module not loaded");
      if (window.AuthManager)
        authToken = await window.AuthManager.getAccessToken();
      exportData = await window.ChatGPTHandler.extract(updateStatus);
    } else if (provider === "claude") {
      if (!window.ClaudeHandler)
        throw new Error("Claude Handler module not loaded");
      exportData = await window.ClaudeHandler.extract(updateStatus);
    } else {
      throw new Error("Unknown provider");
    }

    if (exportData) {
      await createAndDownloadZip(exportData, updateStatus, authToken);
    }

    setTimeout(() => {
      if (statusDiv.parentNode) document.body.removeChild(statusDiv);
    }, 3000);
  } catch (e) {
    console.error(e);
    updateStatus(`Error: ${e.message}`);
    setTimeout(() => {
      if (statusDiv.parentNode) document.body.removeChild(statusDiv);
    }, 5000);
  }
}

function addFloatingButton(id, color, handler) {
  if (document.getElementById(id)) return;
  const btn = document.createElement("button");
  btn.id = id;
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
  btn.style.cssText = `position: fixed; bottom: 20px; right: 20px; width: 50px; height: 50px; background-color: ${color}; color: white; border: none; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.3); cursor: pointer; z-index: 9999; display: flex; align-items: center; justify-content: center; transition: transform 0.2s;`;
  btn.onclick = handler;
  document.body.appendChild(btn);
}

function setupPageMonitor() {
  const provider = getProvider();

  if (provider === "claude") {
    setInterval(() => {
      if (window.location.pathname.includes("/chat/")) {
        addFloatingButton("claude-export-btn", "#da7756", handleExportClick);
        const btn = document.getElementById("claude-export-btn");
        if (btn) btn.style.display = "flex";
      } else {
        const btn = document.getElementById("claude-export-btn");
        if (btn) btn.style.display = "none";
      }
    }, 1000);
  } else if (provider === "gemini") {
    addFloatingButton("gemini-export-btn", "#1d4ed8", handleExportClick);
  } else if (provider === "chatgpt") {
    setInterval(() => {
      if (
        document.querySelector("form") ||
        document.querySelector("[data-message-id]")
      ) {
        addFloatingButton("chatgpt-export-btn", "#10a37f", handleExportClick);
      }
    }, 2000);
  }
}

if (document.readyState === "loading")
  window.addEventListener("load", () => setTimeout(setupPageMonitor, 1000));
else setTimeout(setupPageMonitor, 1000);
