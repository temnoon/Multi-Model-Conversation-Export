// ChatGPT Chat Log Export - Media Downloader Module

/**
 * Media Downloader Module
 * Coordinates downloading media files from conversations
 * Uses MediaUrlGenerator and MediaFetcher modules for specific tasks
 */

// Define the module as a global object
window.MediaDownloader = {};

/**
 * Look for sediment URLs directly in the conversation JSON
 * @param {Object} conversationData - The conversation data object
 * @returns {Array} Array of sediment URLs with metadata
 */
function findSedimentUrlsInJson(conversationData) {
  const jsonString = JSON.stringify(conversationData);
  // This more comprehensive regex captures the entire query string including all parameters
  // Also excludes thumbnail/icon paths to prevent downloading the wrong images
  const sedimentRegex = /https?:\/\/sdmntpr[a-z0-9]*\.oaiusercontent\.com\/files\/([0-9a-f\-]+)\/raw\?(?!.*\/drvs\/icon\/)(?!.*\/thumbnail\/)(?!.*_thumb\.)(?!.*_icon\.)[^"'\s\}\)\]]+/g;
  const sedimentMatches = [];
  let match;

  // First collect all the sediment URLs with their full SAS tokens
  while ((match = sedimentRegex.exec(jsonString)) !== null) {
    // Extract the UUID from the URL
    const uuid = match[1];
    const fullUrl = match[0];
    
    // Log the full URL for debugging
    console.log(`Found sediment URL: ${fullUrl}`);
    
    // Only add if it has a SAS token (includes sig= parameter)
    if (fullUrl.includes('sig=')) {
      sedimentMatches.push({
        uuid: uuid,
        url: fullUrl,
        hasSasToken: fullUrl.includes('sig=')
      });
      console.log(`  Added sediment URL with SAS token: ${fullUrl}`);
    }
  }

  return sedimentMatches;
}

/**
 * Download a single media file
 * @param {Object} mediaRef - Media reference object
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} Promise resolving to download result
 */
window.MediaDownloader.downloadMedia = async function(mediaRef, token, conversationData) {
  try {
    // Special handling for sediment images
    if (mediaRef.assetPointer && mediaRef.assetPointer.includes('sediment://')) {
      // Check if we have a renderedUrl for this sediment file (should contain the SAS token)
      if (mediaRef.renderedUrl && mediaRef.renderedUrl.includes('sdmntpr') && 
          mediaRef.renderedUrl.includes('/raw') && mediaRef.renderedUrl.includes('sig=')) {
        // If we have a full URL with the SAS token, use it directly
        window.ExportConfig.log(`Using full sediment URL with SAS token: ${mediaRef.renderedUrl}`);
        
        // Create a folder name based on conversation data
        let downloadFolderName;
        if (conversationData && typeof window.ConversationManager !== 'undefined' && 
            typeof window.ConversationManager.createConversationFolderName === 'function') {
          // Use the same folder name that will be used for other downloads
          downloadFolderName = window.ConversationManager.createConversationFolderName(conversationData);
        } else {
          downloadFolderName = 'chatgpt_export';
        }
        
        // Create a suitable filename
        const filename = window.FileUtils.createSuitableFilename(mediaRef, 'image/png');
        const fullPath = `${downloadFolderName}/media/${filename}`;
        
        // Use the background script to download via chrome.downloads API
        try {
          const downloadResult = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
              action: 'directDownload',
              url: mediaRef.renderedUrl,
              filename: fullPath
            }, (response) => {
              if (chrome.runtime.lastError) {
                window.ExportConfig.error(`Error downloading sediment file: ${chrome.runtime.lastError.message}`);
                resolve({ success: false, error: chrome.runtime.lastError.message });
                return;
              }
              resolve(response || { success: false, error: 'No response from background script' });
            });
          });
          
          if (downloadResult.success) {
            window.ExportConfig.log(`Successfully downloaded sediment file via direct URL with SAS token`);
            return {
              success: true,
              fileId: mediaRef.fileId || mediaRef.assetPointer,
              type: mediaRef.type,
              contentType: 'image/png',
              method: 'direct_sediment_download_with_sas',
              renderedUrl: mediaRef.renderedUrl
            };
          }
        } catch (e) {
          window.ExportConfig.error(`Error downloading from sediment URL with SAS token: ${e.message}`);
        }
      }
      
      // If we don't have a renderedUrl with SAS token, fall back to our region-based approach
      // Extract the file ID without the protocol prefix
      let cleanId = mediaRef.assetPointer.replace('sediment://', '');
      
      // Extract the UUID-style ID (with hyphens)
      const fileUuid = cleanId.startsWith('file_') ? cleanId.substring(5) : cleanId;
      const uuidWithHyphens = fileUuid.includes('-') ? fileUuid : 
                            fileUuid.replace(/([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})/, '$1-$2-$3-$4-$5');
      
      // Try the direct storage URLs first - these work best for sediment files
      // The pattern is: https://sdmntpr{region}.oaiusercontent.com/files/{uuid}/raw
      
      // Get all sediment regions to try
      const regions = window.ExportConfig.sedimentRegions || [
        'westus2', 'eastus2', 'centralus', 'westus3', 'eastus', 'northcentralus', 
        'southcentralus', 'northeurope', 'westeurope', 'australiaeast', 'southeastasia', 'eastasia'
      ];
      
      let downloadSuccess = false;
      
      // Create a folder name based on conversation data
      let downloadFolderName;
      if (conversationData && typeof window.ConversationManager !== 'undefined' && 
          typeof window.ConversationManager.createConversationFolderName === 'function') {
        // Use the same folder name that will be used for other downloads
        downloadFolderName = window.ConversationManager.createConversationFolderName(conversationData);
      } else {
        downloadFolderName = 'chatgpt_export';
      }
      
      // Create a suitable filename
      const filename = window.FileUtils.createSuitableFilename(mediaRef, 'image/png');
      const fullPath = `${downloadFolderName}/media/${filename}`;
      
      // Try each region until one works
      for (const region of regions) {
        const sedimentUrl = `https://sdmntpr${region}.oaiusercontent.com/files/${uuidWithHyphens}/raw`;
        window.ExportConfig.log(`Trying direct sediment URL: ${sedimentUrl}`);
        
        try {
          // Use the background script to download via chrome.downloads API
          const downloadResult = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
              action: 'directDownload',
              url: sedimentUrl,
              filename: fullPath
            }, (response) => {
              if (chrome.runtime.lastError) {
                window.ExportConfig.error(`Error downloading sediment file: ${chrome.runtime.lastError.message}`);
                resolve({ success: false, error: chrome.runtime.lastError.message });
                return;
              }
              resolve(response || { success: false, error: 'No response from background script' });
            });
          });
          
          if (downloadResult.success) {
            window.ExportConfig.log(`Successfully downloaded sediment file via direct URL: ${sedimentUrl}`);
            downloadSuccess = true;
            return {
              success: true,
              fileId: mediaRef.fileId || mediaRef.assetPointer,
              type: mediaRef.type,
              contentType: 'image/png',
              method: 'direct_sediment_download',
              renderedUrl: sedimentUrl
            };
          }
        } catch (e) {
          window.ExportConfig.error(`Error downloading from sediment URL ${sedimentUrl}: ${e.message}`);
        }
      }
      
      // If all direct URLs failed, continue with the standard approach
    }
    
    // Direct strategy for rendered images from DOM
    if (mediaRef.renderedUrl && mediaRef.renderedUrl.startsWith('http')) {
      window.ExportConfig.log(`Using rendered URL for ${mediaRef.type}: ${mediaRef.renderedUrl}`);
      
      try {
        // Use chrome.downloads API to directly download the rendered image URL
        // This bypasses CORS restrictions
        let filename;
        
        // Create a folder name based on conversation data
        let downloadFolderName;
        if (conversationData && typeof window.ConversationManager !== 'undefined' && 
            typeof window.ConversationManager.createConversationFolderName === 'function') {
          // Use the same folder name that will be used for other downloads
          downloadFolderName = window.ConversationManager.createConversationFolderName(conversationData);
          // Set the full download path including the folder
          filename = `${downloadFolderName}/media/${window.FileUtils.createSuitableFilename(mediaRef, 
            mediaRef.renderedUrl.includes('.jpg') || mediaRef.renderedUrl.includes('.jpeg') ? 'image/jpeg' : 'image/png')}`;  
        } else {
          // Fallback to simple filename without folder
          filename = window.FileUtils.createSuitableFilename(mediaRef, 
            mediaRef.renderedUrl.includes('.jpg') || mediaRef.renderedUrl.includes('.jpeg') ? 'image/jpeg' : 'image/png');
        }
        
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.downloads) {
          // First try to use direct download via chrome.downloads API
          try {
            const downloadResult = await new Promise((resolve) => {
              chrome.downloads.download({
                url: mediaRef.renderedUrl,
                filename: filename,
                saveAs: false
              }, (downloadId) => {
                if (chrome.runtime.lastError) {
                  console.error('Direct download error:', chrome.runtime.lastError);
                  resolve({ success: false, error: chrome.runtime.lastError.message });
                  return;
                }
                resolve({ success: true, downloadId });
              });
            });
            
            if (downloadResult.success) {
              window.ExportConfig.log(`Successfully downloaded from rendered URL via chrome.downloads API`);
              return {
                success: true,
                fileId: mediaRef.fileId || mediaRef.assetPointer,
                type: mediaRef.type,
                contentType: mediaRef.renderedUrl.includes('.jpg') || mediaRef.renderedUrl.includes('.jpeg') ? 'image/jpeg' : 'image/png',
                method: 'chrome_downloads_direct',
                renderedUrl: mediaRef.renderedUrl
              };
            }
          } catch (chromeDownloadError) {
            window.ExportConfig.error(`Chrome downloads API error: ${chromeDownloadError.message}`);
          }
        
          // If direct download failed, try through the background script
          try {
            const downloadResult = await new Promise((resolve) => {
              chrome.runtime.sendMessage({
                action: 'directDownload',
                url: mediaRef.renderedUrl,
                filename: filename
              }, (response) => {
                if (chrome.runtime.lastError) {
                  window.ExportConfig.error(`Error downloading rendered URL: ${chrome.runtime.lastError.message}`);
                  resolve({ success: false, error: chrome.runtime.lastError.message });
                  return;
                }
                resolve(response || { success: false, error: 'No response from background script' });
              });
            });
            
            if (downloadResult.success) {
              window.ExportConfig.log(`Successfully downloaded from rendered URL via background script`);
              return {
                success: true,
                fileId: mediaRef.fileId || mediaRef.assetPointer,
                type: mediaRef.type,
                contentType: mediaRef.renderedUrl.includes('.jpg') || mediaRef.renderedUrl.includes('.jpeg') ? 'image/jpeg' : 'image/png',
                method: 'background_script_direct',
                renderedUrl: mediaRef.renderedUrl
              };
            }
          } catch (directError) {
            window.ExportConfig.error(`Error using rendered URL through background script: ${directError.message}`);
          }
        }
      } catch (directError) {
        window.ExportConfig.error(`Error using rendered URL directly: ${directError.message}`);
        // Continue with regular download methods
      }
    }
    // Generate URLs for multiple domains to work around CORS issues
    // We'll try both chat.openai.com and chatgpt.com for maximum compatibility
    let currentDomain;
    try {
      // Get the current hostname
      currentDomain = window.location.hostname;
    } catch (e) {
      // In case of any issues, assume chatgpt.com
      currentDomain = 'chatgpt.com';
    }
    
    // We'll use chat.openai.com as our primary domain for API calls
    // but will also fall back to the current domain if needed
    const primaryDomain = 'chat.openai.com';
    const secondaryDomain = currentDomain;
    
    // Get file identifier
    let fileId = mediaRef.assetPointer || mediaRef.fileId || mediaRef.canvasId;
    if (!fileId) {
      throw new Error('No valid file identifier found');
    }
    
    // Make sure window.MediaUrlGenerator is defined
    if (!window.MediaUrlGenerator || typeof window.MediaUrlGenerator.generateAlternativeUrls !== 'function') {
      throw new Error('MediaUrlGenerator module is not properly loaded');
    }
    
    // Make sure ExportConfig is loaded
    if (!window.ExportConfig) {
      console.error('ExportConfig not found, creating basic log functions');
      window.ExportConfig = {
        log: (...args) => console.log('[ChatGPT Export]', ...args),
        error: (...args) => console.error('[ChatGPT Export]', ...args),
        debug: true
      };
    }
    
    window.ExportConfig.log(`Attempting to download ${mediaRef.type}: ${fileId} using domains: ${primaryDomain} and ${secondaryDomain}`);
    
    // Generate alternative URLs to try for the primary domain
    const primaryUrls = window.MediaUrlGenerator.generateAlternativeUrls(fileId, primaryDomain);
    
    // Also try with the secondary domain for better compatibility
    const secondaryUrls = window.MediaUrlGenerator.generateAlternativeUrls(fileId, secondaryDomain);
    
    // Combine all URLs, but prioritize the primary domain URLs
    const urlsToTry = [...primaryUrls, ...secondaryUrls];
    
    // Add CDN URLs that bypass the OpenAI domains entirely
    // These often work better for direct file access without CORS issues
    const cleanId = fileId.replace('sediment://', '');
    const hasFilePrefix = cleanId.startsWith('file_');
    const actualId = hasFilePrefix ? cleanId.substring(5) : cleanId;
    const withFilePrefix = hasFilePrefix ? cleanId : `file_${cleanId}`;
    
    // First, try with both the raw ID and cleaned ID variants
    const cdnUrls = [
      // New 2025 format with file subdirectory
      `https://files.oaiusercontent.com/file/${actualId}`,
      `https://files.oaiusercontent.com/file/${withFilePrefix}`,
      `https://files.oaiusercontent.com/file/${cleanId}`,
      // Traditional formats
      `https://files.oaiusercontent.com/file-${actualId}`,
      `https://files.oaiusercontent.com/file-${withFilePrefix}`,
      `https://files.oaiusercontent.com/file-${cleanId}`,
      `https://cdn.oaistatic.com/${actualId}`,
      `https://cdn.oaistatic.com/${withFilePrefix}`,
      `https://cdn.oaistatic.com/${cleanId}`,
      `https://cdn.oaistatic.com/images/${actualId}.png`,
      `https://cdn.oaistatic.com/images/${withFilePrefix}.png`,
      `https://cdn.oaistatic.com/images/${cleanId}.png`
    ];
    
    // Add CDN URLs to the beginning (higher priority)
    urlsToTry.unshift(...cdnUrls);
    
    // Log all URLs we're going to try
    window.ExportConfig.log(`Will try ${urlsToTry.length} different URL formats`);
    
    // For sediment files, add the sdmntpr URLs with the correct formats to the beginning of the list
    if (fileId.includes('sediment://') || fileId.startsWith('file_')) {
      // Extract the UUID-style ID
      const rawId = fileId.replace('sediment://', '');
      const cleanId = rawId.startsWith('file_') ? rawId.substring(5) : rawId;
      
      // Format with hyphens if needed
      const uuidWithHyphens = cleanId.includes('-') ? cleanId : 
                            cleanId.replace(/([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})/, '$1-$2-$3-$4-$5');
      
      // Get sediment regions
      const regions = window.ExportConfig.sedimentRegions || [
        'westus2', 'eastus2', 'centralus', 'westus3', 'eastus', 'northcentralus', 
        'southcentralus', 'northeurope', 'westeurope', 'australiaeast', 'southeastasia', 'eastasia'
      ];
      
      // Add the sediment URLs to the beginning (highest priority)
      for (const region of regions) {
        const sedimentUrl = `https://sdmntpr${region}.oaiusercontent.com/files/${uuidWithHyphens}/raw`;
        if (!urlsToTry.includes(sedimentUrl)) {
          urlsToTry.unshift(sedimentUrl);
        }
      }
    }
    
    // First strategy: Try background script direct download
    const backgroundDownload = await window.MediaFetcher.downloadViaBackgroundScript(fileId, urlsToTry, token, mediaRef);
    if (backgroundDownload && backgroundDownload.success) {
      return backgroundDownload;
    }
    
    // Second strategy: Try to get more URLs from file metadata
    const additionalUrls = await window.MediaFetcher.fetchMetadataForUrls(fileId, primaryDomain, token);
    
    // Add any new URLs to the beginning of our list (higher priority)
    for (const url of additionalUrls) {
      if (!urlsToTry.includes(url)) {
        urlsToTry.unshift(url);
      }
    }
    
    // Track results and errors
    let successfulResponse = null;
    let successfulUrl = null;
    let errorMessages = [];
    let jsonResponseUrls = [];
    
    // Third strategy: Try each URL in sequence
    for (const url of urlsToTry) {
      try {
        window.ExportConfig.log(`Trying URL: ${url}`);
        
        // Try background script fetch
        let result = null;
        try {
          result = await window.MediaFetcher.fetchViaBackgroundScript(url, token, fileId, mediaRef);
        } catch (e) {
          errorMessages.push(e.message);
        }
        
        // If background fetch returned a redirect URL, add it to our list
        if (result && result.redirectUrl) {
          jsonResponseUrls.push(result.redirectUrl);
          if (!urlsToTry.includes(result.redirectUrl)) {
            urlsToTry.push(result.redirectUrl);
          }
          continue; // Try next URL
        }
        
        // If background fetch succeeded, use the result
        if (result && result.success) {
          successfulResponse = result;
          successfulUrl = url;
          break;
        }
        
        // If background fetch failed, try direct fetch
        try {
          result = await window.MediaFetcher.fetchDirectly(url, token, fileId, mediaRef);
        } catch (e) {
          errorMessages.push(e.message);
          continue; // Try next URL
        }
        
        // If direct fetch returned a redirect URL, add it to our list
        if (result && result.redirectUrl) {
          jsonResponseUrls.push(result.redirectUrl);
          if (!urlsToTry.includes(result.redirectUrl)) {
            urlsToTry.push(result.redirectUrl);
          }
          continue; // Try next URL
        }
        
        // If direct fetch succeeded, use the result
        if (result && result.success) {
          successfulResponse = result;
          successfulUrl = url;
          break;
        }
      } catch (e) {
        errorMessages.push(`General error for ${url}: ${e.message}`);
      }
    }
    
    // If we found a successful response, fix any content type issues and return it
    if (successfulResponse) {
      window.ExportConfig.log(`Successfully downloaded from ${successfulUrl} via ${successfulResponse.method}`);
      return await window.MediaFetcher.fixContentTypeIssues(successfulResponse, mediaRef);
    }
    
    // Fourth strategy: Try signed URLs with a different approach
    if (jsonResponseUrls.length > 0) {
      window.ExportConfig.log(`Trying JSON redirect URLs with direct fetch...`);
      
      for (const url of jsonResponseUrls) {
        try {
          const result = await window.MediaFetcher.fetchFromSignedUrl(url, fileId, mediaRef);
          if (result && result.success) {
            return await window.MediaFetcher.fixContentTypeIssues(result, mediaRef);
          }
        } catch (e) {
          errorMessages.push(e.message);
        }
      }
    }
    
    // All strategies failed
    const errorMessage = `All URL formats failed. Errors: ${errorMessages.join('; ')}`;
    throw new Error(errorMessage);
    
  } catch (error) {
    window.ExportConfig.error(`Error downloading media:`, error);
    return {
      success: false,
      fileId: mediaRef.fileId || mediaRef.assetPointer,
      type: mediaRef.type,
      error: error.message
    };
  }
};

/**
 * Download all media from a conversation
 * @param {Array} mediaReferences - Array of media references
 * @param {string} token - Authentication token
 * @param {Function} progressCallback - Callback for progress updates
 * @param {Object} conversationData - The conversation data object
 * @returns {Promise<Object>} Promise resolving to download results
 */
window.MediaDownloader.downloadAllMedia = async function(mediaReferences, token, progressCallback, conversationData) {
  // First, check that all necessary modules are loaded
  if (!window.MediaUrlGenerator || typeof window.MediaUrlGenerator.generateAlternativeUrls !== 'function') {
    console.error('MediaUrlGenerator module is not properly loaded');
    throw new Error('MediaUrlGenerator module is not properly loaded');
  }

  // Make sure ExportConfig is loaded
  if (!window.ExportConfig) {
    console.error('ExportConfig not found, creating basic log functions');
    window.ExportConfig = {
      log: (...args) => console.log('[ChatGPT Export]', ...args),
      error: (...args) => console.error('[ChatGPT Export]', ...args),
      debug: true
    };
  }
  
  // First, scan the DOM to find rendered image URLs and ALL ChatGPT images
  // This helps bypass CORS issues for DALL-E (sediment) images
  if (window.MediaExtractor) {
    try {
      // Check if we have direct sediment URLs with SAS tokens in the conversation data
      if (conversationData) {
        // Get sediment URLs with SAS tokens
        const sedimentUrls = findSedimentUrlsInJson(conversationData);
        if (sedimentUrls.length > 0) {
          window.ExportConfig.log(`Found ${sedimentUrls.length} sediment URLs with SAS tokens in conversation JSON`);
          
          // Match them to media references
          mediaReferences.forEach(ref => {
            if (ref.assetPointer && ref.assetPointer.includes('sediment://')) {
              // Extract the UUID from the asset pointer
              const fileId = ref.assetPointer.replace('sediment://', '');
              const rawId = fileId.startsWith('file_') ? fileId.substring(5) : fileId;
              
              // Format with hyphens if needed
              const uuidWithHyphens = rawId.includes('-') ? rawId : 
                                   rawId.replace(/([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})/, '$1-$2-$3-$4-$5');
              
              // Look for matching sediment URLs
              const match = sedimentUrls.find(item => item.uuid === uuidWithHyphens);
              if (match && match.url) {
                // Add the full URL to the media reference
                ref.renderedUrl = match.url;
                window.ExportConfig.log(`Mapped sediment file ${ref.assetPointer} to URL with SAS token`);
              }
            }
          });
        }
      }
      
      // First try to match existing media references with rendered images
      if (typeof window.MediaExtractor.findRenderedImages === 'function') {
        window.ExportConfig.log('Scanning page for rendered images to match with media references...');
        mediaReferences = window.MediaExtractor.findRenderedImages(mediaReferences);
      }
      
      // If we still have sediment images without renderedUrl, try to grab ALL images
      // and add them as additional media references
      if (typeof window.MediaExtractor.findAllRenderedImages === 'function') {
        // Count how many sediment images still need a renderedUrl
        const missingUrlCount = mediaReferences.filter(ref => 
          ref.type === 'image' && 
          ref.assetPointer && 
          ref.assetPointer.includes('sediment://') && 
          !ref.renderedUrl
        ).length;
        
        if (missingUrlCount > 0) {
          window.ExportConfig.log(`Still missing URLs for ${missingUrlCount} sediment images, scanning for all images in page...`);
          const allImages = window.MediaExtractor.findAllRenderedImages();
          
          // Filter to just DALL-E/likely generated images
          const dalleImages = allImages.filter(img => img.isDalleImage);
          window.ExportConfig.log(`Found ${dalleImages.length} DALL-E images in page`);
          
          // Add these as new media references if they're not already represented
          dalleImages.forEach(img => {
            // Check if we already have a reference with this URL
            const hasUrl = mediaReferences.some(ref => ref.renderedUrl === img.renderedUrl);
            if (!hasUrl) {
              // Create a custom ID for this image based on a hash of its URL
              const customId = `img_${img.renderedUrl.split('/').pop().replace(/[^a-zA-Z0-9]/g, '')}`;
              
              // Add a new media reference for this image
              mediaReferences.push({
                type: 'image',
                renderedUrl: img.renderedUrl,
                renderedWidth: img.renderedWidth,
                renderedHeight: img.renderedHeight,
                // Generate a fake fileId to make the rest of the code work
                fileId: customId,
                assetPointer: null,
                messageId: img.messageId,
                title: img.alt || 'DALL-E Image',
                isDalleImage: true,
                // Use the URL itself as a basis for the custom name
                customName: `dalle_image_${customId}`
              });
            }
          });
        }
      }
    } catch (e) {
      window.ExportConfig.error('Error scanning for rendered images:', e);
    }
  }
  
  const results = {
    total: mediaReferences.length,
    completed: 0,
    failed: 0,
    files: []
  };
  
  // Create a folder name based on conversation data
  const folderName = window.ConversationManager.createConversationFolderName(conversationData);
  
  // Prepare and enhance media references
  for (const media of mediaReferences) {
    // Add DALL-E specific info to filename if available
    if (media.type === 'image' && media.metadata && media.metadata.dalle) {
      // Create a meaningful filename for DALL-E images if possible
      if (media.metadata.dalle.prompt) {
        // Create a short name from the prompt
        const promptWords = media.metadata.dalle.prompt.split(' ').filter(word => word.length > 3);
        const shortPrompt = promptWords.slice(0, 5).join('_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
        if (shortPrompt) {
          media.customName = `dalle_${shortPrompt}`;
        } else {
          media.customName = `dalle_${media.metadata.dalle.gen_id || media.fileId}`;
        }
      } else if (media.metadata.dalle.gen_id) {
        media.customName = `dalle_${media.metadata.dalle.gen_id}`;
      }
    }
    
    // If media has a title from metadata, use it
    if (media.title) {
      const safeTitle = media.title.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
      if (!media.customName) {
        media.customName = safeTitle;
      }
    }
  }
  
  // Try to find direct signed URLs in the JSON response if no media refs were found
  // or previous downloads failed
  if ((mediaReferences.length === 0 || results.failed > 0) && conversationData) {
    window.ExportConfig.log('Looking for direct file URLs in the conversation JSON...');
    
    // Look for signed URLs directly in the conversation data
    // This regex looks for file URLs to oaiusercontent.com
    const jsonString = JSON.stringify(conversationData);
    const fileIdMatches = jsonString.match(/https?:\/\/(files[0-9]*|sdmntpr[a-z0-9]*)\.(oai|openai)usercontent\.com\/[^"']+/g) || [];
    
    // Also look specifically for sdmntpr URLs (the sediment storage URLs)
    const sedimentRegex = /https?:\/\/sdmntpr[a-z0-9]*\.oaiusercontent\.com\/files\/[0-9a-f\-]+\/raw[^"']*/g;
    const sedimentMatches = jsonString.match(sedimentRegex) || [];
    
    // Combine both match sets, prioritizing sediment URLs
    const allUrlMatches = [...sedimentMatches];
    for (const url of fileIdMatches) {
      if (!allUrlMatches.includes(url)) {
        allUrlMatches.push(url);
      }
    }
    
    // Also look for direct download URLs with file IDs
    const fileIdRegex = /file-[a-zA-Z0-9]{20,}/g;
    const fileIds = jsonString.match(fileIdRegex) || [];
    
    if (allUrlMatches.length > 0 || fileIds.length > 0) {
      window.ExportConfig.log(`Found ${allUrlMatches.length} potential direct URLs (${sedimentMatches.length} sediment URLs) and ${fileIds.length} file IDs in conversation JSON`);
      
      // First try the direct URLs if any were found
      for (let i = 0; i < allUrlMatches.length; i++) {
        const directUrl = allUrlMatches[i];
        
        // Detect if this is a sediment URL
        const isSedimentUrl = directUrl.includes('sdmntpr') && directUrl.includes('/raw');
        
        // Extract filename from URL if possible
        let fileName = `direct-file-${i}`;
        if (isSedimentUrl) {
          // For sediment URLs, extract the UUID from the path
          const sedimentMatch = directUrl.match(/\/files\/([0-9a-f\-]+)\/raw/);
          if (sedimentMatch && sedimentMatch[1]) {
            fileName = `dalle_${sedimentMatch[1]}.png`;
          }
        } else {
          const filenameMatch = directUrl.match(/filename%3D([^&]+)/i);
          if (filenameMatch && filenameMatch[1]) {
            fileName = decodeURIComponent(filenameMatch[1]);
          } else {
            // Use the file ID as a fallback
            const idMatch = directUrl.match(/\/([^\/\?]+)\?/i);
            if (idMatch && idMatch[1]) {
              fileName = 'file-' + idMatch[1];
            }
          }
        }
        
        // Detect file extension from URL
        let fileExt = 'bin';
        if (isSedimentUrl) {
          // For sediment URLs, they are almost always PNG images
          fileExt = 'png';
        } else if (directUrl.includes('jpg') || directUrl.includes('jpeg')) {
          fileExt = 'jpg';
        } else if (directUrl.includes('png')) {
          fileExt = 'png';
        } else if (directUrl.includes('pdf')) {
          fileExt = 'pdf';
        }
        
        // Ensure filename has extension
        if (!fileName.includes('.')) {
          fileName += '.' + fileExt;
        }
        
        window.ExportConfig.log(`Trying to download direct URL: ${directUrl} as ${fileName}`);
        
        // Use chrome.downloads API to directly download the URL (bypass CORS)
        try {
          await new Promise((resolve) => {
            chrome.downloads.download({
              url: directUrl,
              filename: `${folderName}/media/${fileName}`,
              saveAs: false
            }, (downloadId) => {
              if (chrome.runtime.lastError) {
                window.ExportConfig.error(`Error downloading ${directUrl}: ${chrome.runtime.lastError.message}`);
                resolve(false);
                return;
              }
              window.ExportConfig.log(`Started direct download with ID ${downloadId}`);
              resolve(true);
            });
          });
          
          // Count this as a success
          results.completed++;
          results.files.push({
            filename: fileName,
            result: {
              success: true,
              url: directUrl,
              method: 'direct_chrome_download'
            }
          });
        } catch (e) {
          window.ExportConfig.error(`Failed to download ${directUrl}: ${e.message}`);
        }
        
        // Small delay to avoid overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  
  // Download each media file
  for (let i = 0; i < mediaReferences.length; i++) {
    const media = mediaReferences[i];
    
    if (progressCallback) {
      progressCallback(`Downloading media ${i+1}/${mediaReferences.length}...`);
    }
    
    const result = await window.MediaDownloader.downloadMedia(media, token, conversationData);
    
    if (result.success) {
      results.completed++;
      
      // Get a suitable filename
      const filename = window.FileUtils.createSuitableFilename(media, result.contentType);
      
      // Store the result
      results.files.push({
        media: media,
        result: result,
        filename: filename
      });
      
      // Create download link for this file
      if (result.blob) {
        // Path for the file within the conversation folder
        const filePath = `${folderName}/media/${filename}`;
        
        // Download the file with the proper path
        await window.FileUtils.downloadBlobToPath(result.blob, filePath);
        
        // Log success with method used
        window.ExportConfig.log(`Successfully downloaded ${filePath} via ${result.method}`);
      } else if (result.renderedUrl) {
        // The file was already downloaded via chrome.downloads.download in the downloadMedia function
        // No need to download again, just log success
        window.ExportConfig.log(`Successfully downloaded image via rendered URL: ${result.renderedUrl}`);
      }
      
      // Small delay to avoid overwhelming the browser
      await new Promise(resolve => setTimeout(resolve, 300));
    } else {
      results.failed++;
      
      // Store the failed result
      results.files.push({
        media: media,
        result: result,
        error: result.error
      });
      
      // Log failure
      window.ExportConfig.error(`Failed to download ${media.type} ${media.fileId || media.assetPointer}: ${result.error}`);
    }
  }
  
  return results;
};

// Log that the module is loaded
console.log('MediaDownloader module loaded and attached to window', window.MediaDownloader);