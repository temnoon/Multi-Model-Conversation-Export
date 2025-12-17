// ChatGPT Chat Log Export - Media Fetcher Module

/**
 * Media Fetcher Module
 * Handles fetching of media files using different strategies
 */

// Define module as a global object
window.MediaFetcher = {};

/**
 * Try to download a file via the background script
 * @param {string} fileId - File ID
 * @param {Array<string>} urlsToTry - URLs to try
 * @param {string} token - Authentication token
 * @param {Object} mediaRef - Media reference object
 * @returns {Promise<Object|null>} Download result or null if failed
 */
window.MediaFetcher.downloadViaBackgroundScript = async function(fileId, urlsToTry, token, mediaRef) {
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    return null;
  }
  
  try {
    window.ExportConfig.log('Attempting download through background script...');
    
    // Create a suitable filename
    const filename = window.FileUtils.createSuitableFilename(mediaRef);
    
    const response = await chrome.runtime.sendMessage({
      action: 'downloadMedia',
      url: fileId, // Pass the raw ID
      urlsToTry: urlsToTry, // Pass all URLs to try
      token: token,
      filename: filename
    });
    
    if (response && response.success) {
      window.ExportConfig.log(`Successfully downloaded via background script: ${filename}`);
      return {
        success: true,
        fileId: fileId,
        type: mediaRef.type,
        filename: filename,
        method: 'background_direct'
      };
    } else if (response && response.error) {
      throw new Error(`Background download failed: ${response.error}`);
    }
  } catch (e) {
    window.ExportConfig.log(`Background script direct download failed: ${e.message}`);
    return null;
  }
  
  return null;
};

/**
 * Try to fetch metadata from info endpoints that might contain download URLs
 * @param {string} fileId - File ID
 * @param {string} domain - Domain name
 * @param {string} token - Authentication token
 * @returns {Promise<Array<string>>} Additional URLs to try
 */
window.MediaFetcher.fetchMetadataForUrls = async function(fileId, domain, token) {
  const jsonResponseUrls = [];
  
  // Only try for DALL-E images and file-based references
  if (fileId.includes('sediment://') || fileId.includes('file_') || fileId.includes('file-')) {
    try {
      // Clean the ID for DALL-E images
      let dalleId = fileId;
      if (dalleId.includes('sediment://')) {
        dalleId = dalleId.split('sediment://')[1];
      }
      
      // Try with both domains to handle CORS issues
      const domains = ['chat.openai.com', 'chatgpt.com'];
      
      // For each domain, try various URL patterns
      for (const currentDomain of domains) {
        // Initialize array of URLs to try
        const infoUrls = [];
        
        // Add standard file info endpoints
        infoUrls.push(
          `https://${currentDomain}/backend-api/files/${dalleId}`,
          `https://${currentDomain}/backend-api/files/info/${dalleId}`,
          `https://${currentDomain}/backend-api/files/info/${dalleId.replace(/^file_/, '')}`
        );
        
        // Add sediment-specific endpoints for DALL-E images
        if (fileId.includes('sediment://')) {
          infoUrls.push(
            `https://${currentDomain}/backend-api/sediment/info/${dalleId}`,
            `https://${currentDomain}/backend-api/sediment/info/${dalleId.replace(/^file_/, '')}`,
            `https://${currentDomain}/backend-api/images/generations/${dalleId}`,
            `https://${currentDomain}/backend-api/images/generations/${dalleId.replace(/^file_/, '')}`
          );
        }
        
        // For each URL, try fetching via background script first, then direct fetch
        for (const infoUrl of infoUrls) {
          try {
            window.ExportConfig.log(`Checking for file info at: ${infoUrl}`);
            
            // First try via background script (avoids CORS)
            let jsonData = null;
            if (typeof chrome !== 'undefined' && chrome.runtime) {
              try {
                const backgroundResponse = await chrome.runtime.sendMessage({
                  action: 'fetchMedia',
                  url: infoUrl,
                  token: token
                });
                
                if (backgroundResponse && backgroundResponse.success) {
                  // Parse data URL to get JSON
                  jsonData = await parseDataUrl(backgroundResponse.dataUrl);
                }
              } catch (backError) {
                window.ExportConfig.log(`Background fetch error for ${infoUrl}: ${backError.message}`);
              }
            }
            
            // If background script didn't work, try direct fetch
            if (!jsonData) {
              try {
                const infoResponse = await fetch(infoUrl, {
                  method: 'GET',
                  credentials: 'include',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': '*/*',
                    'Content-Type': 'application/json'
                  }
                });
                
                if (infoResponse.ok) {
                  jsonData = await infoResponse.json();
                }
              } catch (fetchError) {
                window.ExportConfig.log(`Direct fetch error for ${infoUrl}: ${fetchError.message}`);
              }
            }
            
            // If we got JSON data, look for file URLs
            if (jsonData) {
              window.ExportConfig.log('Received JSON response:', jsonData);
              
              const fileUrl = window.MediaUrlGenerator.parseJsonForFileUrl(jsonData);
              if (fileUrl) {
                window.ExportConfig.log(`Found file URL in JSON response: ${fileUrl}`);
                jsonResponseUrls.push(fileUrl);
                return jsonResponseUrls; // Exit early if we found a URL
              }
            }
          } catch (e) {
            window.ExportConfig.log(`Error processing info from ${infoUrl}: ${e.message}`);
          }
        }
      }
    } catch (e) {
      window.ExportConfig.log(`Error in metadata fetch process: ${e.message}`);
    }
  }
  
  return jsonResponseUrls;
};

// Helper function to parse data URL to JSON
async function parseDataUrl(dataUrl) {
  try {
    if (!dataUrl) return null;
    
    // Extract data part from data URL
    const base64Data = dataUrl.split(',')[1];
    if (!base64Data) return null;
    
    // Convert to text and parse as JSON
    const text = atob(base64Data);
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

/**
 * Try to fetch a file using the background script
 * @param {string} url - URL to fetch
 * @param {string} token - Authentication token
 * @param {string} fileId - File ID
 * @param {Object} mediaRef - Media reference object
 * @returns {Promise<Object|null>} Fetch result or null if failed
 */
window.MediaFetcher.fetchViaBackgroundScript = async function(url, token, fileId, mediaRef) {
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    return null;
  }
  
  try {
    const backgroundResponse = await chrome.runtime.sendMessage({
      action: 'fetchMedia',
      url: url,
      token: token
    });
    
    if (backgroundResponse.success) {
      window.ExportConfig.log(`Successfully fetched via background script: ${url}`);
      
      // Convert data URL back to blob
      const dataUrlParts = backgroundResponse.dataUrl.split(',');
      const mimeType = dataUrlParts[0].match(/:(.*?);/)[1];
      const byteString = atob(dataUrlParts[1]);
      const arrayBuffer = new ArrayBuffer(byteString.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i);
      }
      
      const blob = new Blob([arrayBuffer], { type: mimeType });
      
      // Check if the blob actually contains binary data
      const isBinary = await window.FileUtils.isBinaryBlob(blob);
      if (!isBinary) {
        window.ExportConfig.log(`Warning: Response from ${url} appears to be JSON/text, not binary data`);
        
        // Try to parse as JSON to see if it contains a redirect URL
        const jsonData = await window.FileUtils.tryParseJson(blob);
        if (jsonData) {
          const redirectUrl = window.MediaUrlGenerator.parseJsonForFileUrl(jsonData);
          if (redirectUrl) {
            window.ExportConfig.log(`Found redirect URL in JSON: ${redirectUrl}`);
            return { redirectUrl };
          }
        }
        
        return null;
      }
      
      // For image/audio responses, detect formats more reliably
      const detectedType = window.FileUtils.detectFileTypeFromBytes(
        new Uint8Array(arrayBuffer, 0, Math.min(arrayBuffer.byteLength, 12))
      );
      
      if (detectedType) {
        // Create a new blob with the correct content type
        const correctedBlob = new Blob([arrayBuffer], { type: detectedType });
        
        return {
          success: true,
          fileId: fileId,
          type: mediaRef.type,
          contentType: detectedType,
          size: correctedBlob.size,
          blob: correctedBlob,
          originalName: mediaRef.filename || mediaRef.customName || null,
          method: 'background_fetch'
        };
      } else {
        // Use the blob as is
        return {
          success: true,
          fileId: fileId,
          type: mediaRef.type,
          contentType: mimeType,
          size: blob.size,
          blob: blob,
          originalName: mediaRef.filename || mediaRef.customName || null,
          method: 'background_fetch'
        };
      }
    } else if (backgroundResponse.error) {
      throw new Error(`Background fetch failed: ${backgroundResponse.error}`);
    }
  } catch (e) {
    throw new Error(`Error with background fetch for ${url}: ${e.message}`);
  }
  
  return null;
};

/**
 * Try to fetch a file directly
 * @param {string} url - URL to fetch
 * @param {string} token - Authentication token
 * @param {string} fileId - File ID
 * @param {Object} mediaRef - Media reference object
 * @returns {Promise<Object|null>} Fetch result or null if failed
 */
window.MediaFetcher.fetchDirectly = async function(url, token, fileId, mediaRef) {
  try {
    // Try with standard Bearer token auth first
    let response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      mode: 'cors',
      cache: 'no-cache'
    });
    
    // If that fails with 401, try without auth header (for public CDN URLs)
    if (response.status === 401 && (url.includes('cdn.oaistatic.com') || url.includes('files.oaiusercontent.com'))) {
      window.ExportConfig.log(`Retrying ${url} without auth header as it might be a public URL`);
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': '*/*',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        mode: 'cors',
        cache: 'no-cache'
      });
    }
    
    if (response.ok) {
      window.ExportConfig.log(`Successfully fetched via direct fetch: ${url}`);
      
      const arrayBuffer = await response.arrayBuffer();
      const contentTypeHeader = response.headers.get('Content-Type');
      
      // Create a blob to check if it's binary
      const tempBlob = new Blob([arrayBuffer]);
      const isBinary = await window.FileUtils.isBinaryBlob(tempBlob);
      
      if (!isBinary) {
        window.ExportConfig.log(`Warning: Response from ${url} appears to be JSON/text, not binary data`);
        
        // Try to parse as JSON to see if it contains a redirect URL
        const jsonData = await window.FileUtils.tryParseJson(tempBlob);
        if (jsonData) {
          const redirectUrl = window.MediaUrlGenerator.parseJsonForFileUrl(jsonData);
          if (redirectUrl) {
            window.ExportConfig.log(`Found redirect URL in JSON: ${redirectUrl}`);
            return { redirectUrl };
          }
        }
        
        return null;
      }
      
      // Detect the content type from the first bytes
      const detectedType = window.FileUtils.detectFileTypeFromBytes(
        new Uint8Array(arrayBuffer, 0, Math.min(arrayBuffer.byteLength, 12))
      );
      
      // Use the detected type or fall back to the header or media type
      let contentType = detectedType || contentTypeHeader;
      
      // If still no good content type, use defaults based on media type
      if (!contentType || contentType === 'application/octet-stream' || contentType === 'application/json') {
        if (mediaRef.type === 'image') {
          contentType = 'image/jpeg';
        } else if (mediaRef.type === 'audio') {
          contentType = 'audio/mpeg';
        } else if (mediaRef.type === 'video') {
          contentType = 'video/mp4';
        } else {
          contentType = 'application/octet-stream';
        }
      }
      
      // Create a blob with the correct content type
      const blob = new Blob([arrayBuffer], { type: contentType });
      
      return {
        success: true,
        fileId: fileId,
        type: mediaRef.type,
        contentType: contentType,
        size: blob.size,
        blob: blob,
        originalName: mediaRef.filename || mediaRef.customName || null,
        method: 'direct_fetch'
      };
    } else {
      throw new Error(`Direct fetch failed with status ${response.status}`);
    }
  } catch (e) {
    throw new Error(`Error with direct fetch for ${url}: ${e.message}`);
  }
  
  return null;
};

/**
 * Try to fetch a file from a signed URL
 * @param {string} url - URL to fetch
 * @param {string} fileId - File ID
 * @param {Object} mediaRef - Media reference object
 * @returns {Promise<Object|null>} Fetch result or null if failed
 */
window.MediaFetcher.fetchFromSignedUrl = async function(url, fileId, mediaRef) {
  try {
    // Try a direct fetch to the URL without any auth tokens
    // This is because signed URLs already include auth info
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      mode: 'cors',
      cache: 'no-cache'
    });
    
    if (response.ok) {
      window.ExportConfig.log(`Successfully fetched signed URL via direct fetch: ${url}`);
      
      const arrayBuffer = await response.arrayBuffer();
      const contentTypeHeader = response.headers.get('Content-Type');
      
      // Create a blob with the content type
      const blob = new Blob([arrayBuffer], { 
        type: contentTypeHeader || 'application/octet-stream' 
      });
      
      return {
        success: true,
        fileId: fileId,
        type: mediaRef.type,
        contentType: contentTypeHeader || 'application/octet-stream',
        size: blob.size,
        blob: blob,
        originalName: mediaRef.filename || mediaRef.customName || null,
        method: 'signed_url_fetch'
      };
    }
  } catch (e) {
    window.ExportConfig.log(`Error fetching signed URL ${url}: ${e.message}`);
  }
  
  return null;
};

/**
 * Fix content type issues with the blob based on file extension
 * @param {Object} response - Download response
 * @param {Object} mediaRef - Media reference object
 * @returns {Promise<Object>} Fixed response
 */
window.MediaFetcher.fixContentTypeIssues = async function(response, mediaRef) {
  if (!response.blob) return response;
  
  // Get the extension from the filename that would be used
  const filename = window.FileUtils.createSuitableFilename(mediaRef, response.contentType);
  const fileExt = filename.split('.').pop().toLowerCase();
  
  // Handle JPEG and JPG files specifically
  if ((fileExt === 'jpg' || fileExt === 'jpeg') && 
      (!response.contentType.includes('jpeg') || 
       response.contentType.includes('json'))) {
    // Create a new blob with the correct content type
    window.ExportConfig.log(`Fixing content type for JPEG file (was: ${response.contentType})`);
    const newBlob = new Blob([await response.blob.arrayBuffer()], { type: 'image/jpeg' });
    response.blob = newBlob;
    response.contentType = 'image/jpeg';
  }
  
  // Handle PNG files too
  if (fileExt === 'png' && 
      (!response.contentType.includes('png') || 
       response.contentType.includes('json'))) {
    // Create a new blob with the correct content type
    window.ExportConfig.log(`Fixing content type for PNG file (was: ${response.contentType})`);
    const newBlob = new Blob([await response.blob.arrayBuffer()], { type: 'image/png' });
    response.blob = newBlob;
    response.contentType = 'image/png';
  }
  
  return response;
};

// Log that the module is loaded
console.log('MediaFetcher module loaded and attached to window', window.MediaFetcher);
