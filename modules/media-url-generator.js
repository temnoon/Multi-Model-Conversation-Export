// ChatGPT Chat Log Export - Media URL Generator Module

/**
 * Media URL Generator Module
 * Handles construction and generation of URLs for media files
 */

// Define module as a global object
window.MediaUrlGenerator = {};

/**
 * Construct the base URL for a media file
 * @param {Object} mediaRef - Media reference object
 * @returns {string|null} URL to the media file or null if invalid
 */
window.MediaUrlGenerator.constructMediaUrl = function(mediaRef) {
  if (!mediaRef) return null;
  
  // Base URL for media files
  const domain = window.location.hostname;
  const baseUrl = `https://${domain}`;
  
  // Extract file ID, removing any protocol prefixes
  let fileId = null;
  let fileType = mediaRef.type;
  
  if (mediaRef.assetPointer) {
    // Extract the actual file ID
    fileId = mediaRef.assetPointer;
  } else if (mediaRef.fileId) {
    fileId = mediaRef.fileId;
  } else if (mediaRef.canvasId) {
    return `${baseUrl}/backend-api/canvases/${mediaRef.canvasId}`;
  } else {
    return null;
  }
  
  // Return the URL
  return `${baseUrl}/backend-api/files/${fileId}`;
};

/**
 * Generate alternative URLs to try for a file
 * @param {string} fileId - File identifier
 * @param {string} domain - Domain
 * @returns {Array<string>} Array of URLs to try
 */
window.MediaUrlGenerator.generateAlternativeUrls = function(fileId, domain) {
  const baseUrl = `https://${domain}`;
  
  // Need different strategies based on the file ID format
  // DALL-E images (new format): sediment://file_XXXXX
  // DALL-E images (old format): sediment://XXXXX
  // User uploads: file-service://file-XXXXX
  
  const isDalleImageNew = fileId.includes('sediment://file_') || fileId.startsWith('file_');
  const isDalleImageOld = fileId.includes('sediment://') && !fileId.includes('sediment://file_');
  const isUserUpload = fileId.includes('file-service://') || fileId.includes('file-');
  
  // Clean the file ID - remove any protocol prefixes
  let cleanId = fileId;
  
  // For new DALL-E images (sediment://file_XXXXX format)
  if (isDalleImageNew) {
    // If full sediment protocol, extract just the ID
    if (fileId.includes('sediment://')) {
      cleanId = fileId.split('sediment://')[1];
    }
    
    // Handle both with and without file_ prefix
    const hasFilePrefix = cleanId.startsWith('file_');
    const withoutFilePrefix = hasFilePrefix ? cleanId.substring(5) : cleanId;
    const withFilePrefix = hasFilePrefix ? cleanId : `file_${cleanId}`;
    
    // For sediment files, the ID format is often UUID-like with hyphens
    // Extract the UUID format by removing file_ if present
    const fileUuid = withoutFilePrefix.includes('-') ? withoutFilePrefix : 
                     withoutFilePrefix.replace(/([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})/, '$1-$2-$3-$4-$5');

    // Generate optimized URLs to try - focusing on known working patterns
    const urls = [];
    
    // PRIORITY 1: Try the sediment storage URLs - these are the most reliable
    // This is where the actual files are stored in Azure Blob Storage
    const regions = window.ExportConfig && window.ExportConfig.sedimentRegions ? 
                    window.ExportConfig.sedimentRegions : 
                    ['westus2', 'centralus', 'westus3', 'eastus2', 'eastus', 'northcentralus', 
                    'southcentralus', 'northeurope', 'westeurope', 'australiaeast', 'southeastasia', 'eastasia'];
    
    for (const region of regions) {
      urls.push(`https://sdmntpr${region}.oaiusercontent.com/files/${fileUuid}/raw`);
    }
    
    // PRIORITY 2: Try a smaller subset of API endpoints most likely to work
    // Sediment-specific endpoints
    urls.push(
      `${baseUrl}/backend-api/sediment/content/${withFilePrefix}`,
      `${baseUrl}/backend-api/sediment/content/${withoutFilePrefix}`,
      `${baseUrl}/backend-api/sediment/files/${withFilePrefix}`,
      `${baseUrl}/backend-api/sediment/files/${withoutFilePrefix}`
    );

    // PRIORITY 3: Add a few CDN paths for completeness
    urls.push(
      `https://files.oaiusercontent.com/file/${fileUuid}`,
      `https://files.oaiusercontent.com/file/${withFilePrefix}`
    );

    return urls;
  }
  // For old DALL-E images (sediment protocol) but not the file_ format
  else if (isDalleImageOld) {
    // If full sediment protocol, extract just the ID
    if (fileId.includes('sediment://')) {
      cleanId = fileId.split('sediment://')[1];
    }
    
    // Try with a more concise set of URLs
    return [
      // First try the direct sediment endpoints
      `${baseUrl}/backend-api/sediment/content/${cleanId}`,
      `${baseUrl}/backend-api/sediment/files/${cleanId}`,
      
      // Then try CDN access
      `https://files.oaiusercontent.com/file/${cleanId}`,
      `https://cdn.oaistatic.com/images/${cleanId}.png`,
      
      // Then a couple of API endpoints
      `${baseUrl}/backend-api/images/generations/${cleanId}`,
      `${baseUrl}/backend-api/images/${cleanId}/content`
    ];
  } 
  // For user uploaded files (file-service protocol)
  else if (isUserUpload) {
    // If full protocol, extract just the ID
    if (fileId.includes('file-service://')) {
      cleanId = fileId.split('file-service://')[1];
    }
    
    return [
      // Direct binary access
      `${baseUrl}/backend-api/files/content/${cleanId}?format=binary`,
      `${baseUrl}/backend-api/files/download/content/${cleanId}`,
      
      // CDN access
      `https://files.oaiusercontent.com/file/${cleanId}`,
      `https://files.oaiusercontent.com/file-${cleanId}`
    ];
  }
  // For other file types (fallback)
  else {
    if (fileId.includes('://')) {
      cleanId = fileId.split('://')[1];
    }
    
    return [
      `${baseUrl}/backend-api/files/content/${cleanId}?format=binary`,
      `https://files.oaiusercontent.com/file/${cleanId}`
    ];
  }
};

/**
 * Parse JSON response to find file URL
 * @param {Object} jsonData - JSON data from response
 * @returns {string|null} File URL if found, null otherwise
 */
window.MediaUrlGenerator.parseJsonForFileUrl = function(jsonData) {
  // Debug the received JSON structure
  if (window.ExportConfig.debug) {
    try {
      console.log('Parsing JSON for file URL:', JSON.stringify(jsonData, null, 2));
    } catch (e) {
      console.log('Cannot stringify JSON, but still checking for file URL');
    }
  }

  // Look for sediment URLs first (highest priority)
  let sedimentUrls = [];
  try {
    sedimentUrls = findSedimentUrls(jsonData);
    if (sedimentUrls.length > 0) {
      if (window.ExportConfig) {
        window.ExportConfig.log(`Found ${sedimentUrls.length} sediment URLs in JSON response`);
      } else {
        console.log('[ChatGPT Export] Found', sedimentUrls.length, 'sediment URLs in JSON response');
      }
      return sedimentUrls[0]; // Return the first one
    }
  } catch (e) {
    console.error('[ChatGPT Export] Error finding sediment URLs:', e);
  }

  // Check for direct download_url or url field
  if (jsonData.download_url) return jsonData.download_url;
  if (jsonData.url) return jsonData.url;
  
  // Check for file_url, file_uri, or path
  if (jsonData.file_url) return jsonData.file_url;
  if (jsonData.file_uri) return jsonData.file_uri;
  if (jsonData.path) return jsonData.path;
  
  // Check for signed_url or direct_url fields (used in newer ChatGPT versions)
  if (jsonData.signed_url) return jsonData.signed_url;
  if (jsonData.direct_url) return jsonData.direct_url;
  if (jsonData.download_link) return jsonData.download_link;
  if (jsonData.content_url) return jsonData.content_url;
  
  // Check for nested data structures
  if (jsonData.data) {
    // Check for download_url in data
    if (jsonData.data.download_url) return jsonData.data.download_url;
    if (jsonData.data.url) return jsonData.data.url;
    if (jsonData.data.signed_url) return jsonData.data.signed_url;
    if (jsonData.data.direct_url) return jsonData.data.direct_url;
    
    // Check for nested file or result object
    if (jsonData.data.file) {
      if (jsonData.data.file.url) return jsonData.data.file.url;
      if (jsonData.data.file.download_url) return jsonData.data.file.download_url;
      if (jsonData.data.file.signed_url) return jsonData.data.file.signed_url;
    }
    
    if (jsonData.data.result) {
      if (jsonData.data.result.url) return jsonData.data.result.url;
      if (jsonData.data.result.download_url) return jsonData.data.result.download_url;
      if (jsonData.data.result.signed_url) return jsonData.data.result.signed_url;
    }
  }
  
  // Check for file object
  if (jsonData.file) {
    if (jsonData.file.url) return jsonData.file.url;
    if (jsonData.file.download_url) return jsonData.file.download_url;
    if (jsonData.file.signed_url) return jsonData.file.signed_url;
  }
  
  // Check for result object
  if (jsonData.result) {
    if (jsonData.result.url) return jsonData.result.url;
    if (jsonData.result.download_url) return jsonData.result.download_url;
    if (jsonData.result.signed_url) return jsonData.result.signed_url;
  }

  // Check for blob_url or presigned_url fields
  if (jsonData.blob_url) return jsonData.blob_url;
  if (jsonData.presigned_url) return jsonData.presigned_url;
  
  // Check for storage_url or any URL fields in root
  if (jsonData.storage_url) return jsonData.storage_url;
  
  // Look for any property that looks like a URL to files.oaiusercontent.com or containing download URLs
  for (const key in jsonData) {
    if (typeof jsonData[key] === 'string') {
      const value = jsonData[key];
      if ((value.includes('files.oaiusercontent.com') || value.includes('cdn.oaistatic.com')) && 
          (value.startsWith('http://') || value.startsWith('https://'))) {
        return value;
      }
    }
  }
  
  // Recursive search through nested objects for URL patterns
  function searchForUrlInObject(obj, depth = 0) {
    if (depth > 5) return null; // Prevent excessive recursion
    
    if (typeof obj !== 'object' || obj === null) return null;
    
    for (const key in obj) {
      const value = obj[key];
      
      // Check if this property is a URL string
      if (typeof value === 'string') {
        if ((value.includes('files.oaiusercontent.com') || 
             value.includes('cdn.oaistatic.com') || 
             key.includes('url') || key.includes('link')) && 
            (value.startsWith('http://') || value.startsWith('https://'))) {
          return value;
        }
      } 
      // Recurse into nested objects
      else if (typeof value === 'object' && value !== null) {
        const nestedUrl = searchForUrlInObject(value, depth + 1);
        if (nestedUrl) return nestedUrl;
      }
    }
    
    return null;
  }
  
  // Try deep search for URLs
  const deepSearchUrl = searchForUrlInObject(jsonData);
  if (deepSearchUrl) return deepSearchUrl;
  
  return null;
};

/**
 * Look for sediment URLs in an object recursively
 * @param {Object} obj - Object to search
 * @returns {Array<string>} Array of sediment URLs found
 */
function findSedimentUrls(obj, depth = 0, urls = []) {
  // Prevent excessive recursion
  if (depth > 10 || !obj || typeof obj !== 'object') {
    return urls;
  }
  
  // First try to find URLs in the stringified object
  if (depth === 0) {
    try {
      const objString = JSON.stringify(obj);
      const sedimentRegex = /https?:\/\/sdmntpr[a-z0-9]*\.oaiusercontent\.com\/files\/([0-9a-f\-]+)\/raw\?(?!.*\/drvs\/icon\/)(?!.*\/thumbnail\/)(?!.*_thumb\.)(?!.*_icon\.)[^"'\s\}\)\]]+/g;
      let match;
      while ((match = sedimentRegex.exec(objString)) !== null) {
        if (!urls.includes(match[0])) {
          urls.push(match[0]);
        }
      }
    } catch (e) {
      console.error('Error stringifying object to search for sediment URLs:', e);
    }
  }
  
  // Check all properties of this object
  for (const key in obj) {
    const value = obj[key];
    
    // If this is a string, check if it's a sediment URL
    if (typeof value === 'string') {
      // Check for sdmntpr URLs - these are the direct storage URLs for sediment files
      if (value.includes('sdmntpr') && 
          value.includes('oaiusercontent.com') && 
          value.includes('/files/') && 
          value.startsWith('http')) {
        if (!urls.includes(value)) {
          urls.push(value);
        }
      }
      
      // Also check for signed URLs in URLs with SAS tokens (Azure Storage)
      if (value.includes('oaiusercontent.com') && 
          value.includes('/files/') && 
          value.includes('/raw?') && 
          value.includes('sig=')) {
        if (!urls.includes(value)) {
          urls.push(value);
        }
      }
    }
    // If this is an array or object, recursively search it
    else if (value && typeof value === 'object') {
      findSedimentUrls(value, depth + 1, urls);
    }
  }
  
  return urls;
}

// Log that the module is loaded
console.log('MediaUrlGenerator module loaded and attached to window', window.MediaUrlGenerator);
