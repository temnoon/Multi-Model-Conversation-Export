// ChatGPT Chat Log Export - Media Extractor (Images Only)
window.MediaExtractor = {};

window.MediaExtractor.extractMediaReferences = function (conversationData) {
  const mediaReferences = [];
  if (!conversationData || !conversationData.mapping) return mediaReferences;

  // Scan JSON for DALL-E images
  const jsonString = JSON.stringify(conversationData);
  const sedimentRegex =
    /https?:\/\/[a-z0-9-]+\.oaiusercontent\.com\/files\/([0-9a-f\-]+)\/raw\?(?!.*\/drvs\/icon\/)[^"'\s\}\)\]]+/g;
  let match;
  while ((match = sedimentRegex.exec(jsonString)) !== null) {
    const fileId = match[1];
    if (!mediaReferences.some((r) => r.fileId === fileId)) {
      mediaReferences.push({
        type: "image",
        fileId: fileId,
        assetPointer: `sediment://${fileId}`,
        renderedUrl: match[0],
        isDalleImage: true,
        customName: `dalle_${fileId}`,
        messageId: "found_in_json",
      });
    }
  }

  // Process nodes for User Uploads
  Object.values(conversationData.mapping).forEach((node) => {
    if (!node.message) return;

    if (node.message.content && node.message.content.parts) {
      node.message.content.parts.forEach((part) => {
        // Image Pointers
        if (
          part.content_type === "image_asset_pointer" ||
          (part.image_asset_pointer && part.image_asset_pointer.asset_pointer)
        ) {
          const pointer =
            part.asset_pointer || part.image_asset_pointer.asset_pointer;
          if (pointer) {
            mediaReferences.push({
              type: "image",
              assetPointer: pointer,
              fileId: pointer.replace("sediment://", ""),
              messageId: node.message.id,
              metadata: part.metadata || {},
            });
          }
        }
      });
    }
  });

  return mediaReferences;
};

// Find URLs in the DOM (Images Only)
window.MediaExtractor.findRenderedImages = function (mediaReferences) {
  const allImages = Array.from(document.querySelectorAll("img"));

  mediaReferences.forEach((ref) => {
    if (ref.type !== "image") return;

    // Clean ID
    let searchId = ref.fileId;
    if (searchId && searchId.startsWith("file_"))
      searchId = searchId.substring(5);
    if (searchId && searchId.startsWith("file-"))
      searchId = searchId.substring(5);

    // Match against src
    const match = allImages.find(
      (img) => img.src && img.src.includes(searchId),
    );
    if (match) {
      ref.renderedUrl = match.src;
    }
  });
  return mediaReferences;
};

// Stub for source extraction (kept for compatibility but simplified)
window.MediaExtractor.extractUrlsFromSource = function () {
  return [];
};
