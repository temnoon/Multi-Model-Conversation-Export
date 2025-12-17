// ChatGPT Export Handler - Images Only (Stable)
window.ChatGPTHandler = {
  extract: async function (statusCallback) {
    statusCallback("Accessing ChatGPT internals...");

    // 1. Get Data
    if (!window.ConversationManager)
      throw new Error("ConversationManager not found. Reload page.");

    const convId = window.ConversationManager.getConversationId();
    const data = await window.ConversationManager.getConversation(convId);

    // 2. Build Filename Map (For User Uploads)
    const fileIdToName = new Map();
    if (data.mapping) {
      Object.values(data.mapping).forEach((node) => {
        const msg = node.message;
        if (msg && msg.metadata && Array.isArray(msg.metadata.attachments)) {
          msg.metadata.attachments.forEach((att) => {
            if (att.id && att.name) {
              fileIdToName.set(att.id, att.name);
              // Also store without "file-" prefix
              if (att.id.startsWith("file-")) {
                fileIdToName.set(att.id.substring(5), att.name);
              }
            }
          });
        }
      });
    }

    // 3. Extract Media References (Images Only)
    statusCallback("Analyzing media references...");
    let refs = window.MediaExtractor.extractMediaReferences(data);

    // 4. Find Rendered Images
    refs = window.MediaExtractor.findRenderedImages(refs);

    const media = [];
    const usedFilenames = new Set();

    refs.forEach((ref, index) => {
      // SKIP AUDIO entirely to prevent errors
      if (ref.type === "audio") return;

      let url = ref.renderedUrl || ref.download_url || ref.assetPointer;

      // Handle file-service (User Uploads)
      if (url && url.includes("file-service://")) {
        const id = url.split("file-service://")[1];
        url = `https://chatgpt.com/backend-api/files/${id}/download`;
      }

      // Handle DALL-E / Sediment Images (but only if we have a valid http link)
      if (url && url.startsWith("sediment://")) {
        // If we didn't find a renderedUrl in step 4, skip it.
        // We don't want to try fetching "sediment://" directly.
        if (!ref.renderedUrl) return;
        url = ref.renderedUrl;
      }

      if (!url || !url.startsWith("http")) return;

      // Extensions
      let ext = "jpg"; // Default
      if (ref.mime_type) {
        if (ref.mime_type.includes("png")) ext = "png";
        else if (ref.mime_type.includes("webp")) ext = "webp";
        else if (ref.mime_type.includes("pdf")) ext = "pdf";
        else if (ref.mime_type.includes("text")) ext = "txt";
        else if (ref.mime_type.includes("csv")) ext = "csv";
        else if (
          ref.mime_type.includes("spreadsheet") ||
          ref.mime_type.includes("excel")
        )
          ext = "xlsx";
        else if (ref.mime_type.includes("json")) ext = "json";
      }

      // --- FILENAME RESOLUTION ---
      let baseName = "";

      // Try Map Lookup
      let lookupId = ref.fileId;
      if (!lookupId && ref.assetPointer) {
        lookupId = ref.assetPointer
          .replace("sediment://", "")
          .replace("file-service://", "");
      }

      if (lookupId) {
        if (fileIdToName.has(lookupId)) baseName = fileIdToName.get(lookupId);
        else if (
          lookupId.startsWith("file-") &&
          fileIdToName.has(lookupId.substring(5))
        )
          baseName = fileIdToName.get(lookupId.substring(5));
        else if (
          lookupId.startsWith("file_") &&
          fileIdToName.has(lookupId.substring(5))
        )
          baseName = fileIdToName.get(lookupId.substring(5));
      }

      // Fallback
      if (!baseName) {
        baseName = ref.filename || ref.customName || `file_${index}`;
        if (!baseName.includes(".")) baseName += "." + ext;
      }

      baseName = baseName.replace(/[^a-z0-9_\-\.\s\(\)]/gi, "_");

      // De-dupe
      let counter = 1;
      let finalName = baseName;
      while (usedFilenames.has(finalName)) {
        const lastDot = baseName.lastIndexOf(".");
        if (lastDot > -1) {
          finalName =
            baseName.substring(0, lastDot) +
            `_${counter}` +
            baseName.substring(lastDot);
        } else {
          finalName = `${baseName}_${counter}`;
        }
        counter++;
      }
      usedFilenames.add(finalName);

      media.push({
        url: url,
        filename: finalName,
        originalRef: ref,
      });
    });

    return {
      title: data.title || "ChatGPT Export",
      source: "ChatGPT",
      messages: data.mapping,
      media: media,
    };
  },
};
