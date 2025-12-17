// ChatGPT Chat Log Export - File Utilities Module

/**
 * File Utilities Module
 * Provides helper functions for working with files and media types
 */
window.FileUtils = (() => {
  /**
   * Detect file type from first bytes using magic numbers
   * @param {Uint8Array} bytes - File bytes to check
   * @returns {string|null} MIME type or null if not detected
   */
  function detectFileTypeFromBytes(bytes) {
    if (!bytes || bytes.length < 4) return null;
    
    // Check for common file signatures (magic numbers)
    
    // JPEG: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return 'image/jpeg';
    }
    
    // PNG: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return 'image/png';
    }
    
    // GIF: 47 49 46 38
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return 'image/gif';
    }
    
    // WEBP: 52 49 46 46 (RIFF) + 8 bytes + 57 45 42 50 (WEBP)
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && 
        bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return 'image/webp';
    }
    
    // PDF: 25 50 44 46 (%PDF)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return 'application/pdf';
    }
    
    // MP3: 49 44 33 (ID3) or FF FB (MPEG ADTS)
    if ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || 
        (bytes[0] === 0xFF && (bytes[1] === 0xFB || bytes[1] === 0xF3 || bytes[1] === 0xF2))) {
      return 'audio/mpeg';
    }
    
    // MP4: 66 74 79 70 (ftyp)
    if (bytes.length >= 8 && 
        bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      return 'video/mp4';
    }
    
    // WebM: 1A 45 DF A3 (EBML)
    if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
      return 'video/webm';
    }
    
    // ZIP: 50 4B 03 04 (PK..)
    if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
      return 'application/zip';
    }
    
    // JSON check - a bit more complex since it's text-based
    // Look for '{' or '[' as first non-whitespace character
    const firstNonWhitespace = bytes.findIndex(b => b !== 0x20 && b !== 0x09 && b !== 0x0A && b !== 0x0D);
    if (firstNonWhitespace !== -1 && (bytes[firstNonWhitespace] === 0x7B || bytes[firstNonWhitespace] === 0x5B)) {
      return 'application/json';
    }
    
    // If we can't determine the type, return null
    return null;
  }
  
  /**
   * Get file extension from MIME type
   * @param {string} mimeType - MIME type
   * @param {string} fallbackType - Fallback extension if not found
   * @returns {string} File extension
   */
  function getFileExtension(mimeType, fallbackType = 'bin') {
    // Check in the config file type mappings
    if (ExportConfig.fileTypes[mimeType]) {
      return ExportConfig.fileTypes[mimeType].ext;
    }
    
    // Try extracting from the MIME type itself (e.g., 'application/x-whatever' -> 'whatever')
    const match = mimeType?.match(/[\.\/]([A-Za-z0-9-]+)$/i);
    if (match && match[1] && match[1].length > 1 && match[1].length < 10) {
      return match[1].toLowerCase();
    }
    
    return fallbackType;
  }
  
  /**
   * Get appropriate file extension for a media file
   * @param {string} mediaType - Media type (image, audio, video, file, canvas)
   * @param {string} mimeType - MIME type
   * @param {string} filename - Original filename
   * @param {string} format - Format specified in media reference
   * @returns {string} Appropriate file extension
   */
  function getAppropriateFileExtension(mediaType, mimeType, filename, format) {
    // If the media has a specified format, use that first
    if (format && format.length > 0 && format.length < 5) {
      return format.toLowerCase();
    }
    
    // If we have an original filename with extension, extract that extension
    if (filename && filename.includes('.')) {
      const origExt = filename.split('.').pop().toLowerCase();
      if (origExt && origExt.length > 0 && origExt.length < 5) {
        return origExt;
      }
    }
    
    // Check if the mediaType is an image
    if (mediaType === 'image') {
      // Check if mimeType includes jpeg or jpg
      if (mimeType && (mimeType.includes('jpeg') || mimeType.includes('jpg'))) {
        return 'jpg';
      }
      // Otherwise default to png for images
      return 'png';
    }
    
    // If we have a valid MIME type, use that
    if (mimeType && mimeType !== 'application/octet-stream' && mimeType !== 'application/json') {
      return getFileExtension(mimeType);
    }
    
    // Otherwise use the media type
    if (ExportConfig.defaultFileTypes[mediaType]) {
      return ExportConfig.defaultFileTypes[mediaType].ext;
    }
    
    return 'bin';
  }
  
  /**
   * Create a suitable filename for a media file
   * @param {Object} mediaRef - Media reference object
   * @param {string} contentType - Content type (MIME)
   * @returns {string} Suitable filename
   */
  function createSuitableFilename(mediaRef, contentType) {
    // Special case for sediment images - always use PNG extension
    if (mediaRef.assetPointer && mediaRef.assetPointer.includes('sediment://')) {
      const fileId = mediaRef.fileId || mediaRef.assetPointer.replace('sediment://', '');
      
      // Use customName if available, otherwise create one from the file ID
      let baseName = mediaRef.customName || `dalle_${fileId.split('/').pop()}`;
      
      // Ensure the name doesn't exceed 255 characters
      if (baseName.length > 200) {
        baseName = baseName.substring(0, 200);
      }
      
      // Always use .png extension for DALL-E images
      return `${baseName}.png`;
    }
  
    // Get a suitable file extension
    const ext = getAppropriateFileExtension(mediaRef.type, contentType || mediaRef.mime_type, mediaRef.filename, mediaRef.format);
    
    // Special formatting for PNG files as requested: file-<file id>-<original uploaded or generated filename>.png
    if (ext === 'png') {
      // Extract the file ID
      const fileId = mediaRef.fileId || mediaRef.assetPointer || mediaRef.canvasId || 'unknown';
      // Clean up the file ID - remove any protocol prefixes
      const cleanId = fileId.includes('://') ? fileId.split('://').pop() : fileId;
      
      // Get original filename or generated name
      let originalFilename = '';
      if (mediaRef.filename && mediaRef.filename.length > 0) {
        // Remove any extension from original filename
        originalFilename = mediaRef.filename.includes('.')
          ? mediaRef.filename.substring(0, mediaRef.filename.lastIndexOf('.'))
          : mediaRef.filename;
      } else if (mediaRef.customName) {
        originalFilename = mediaRef.customName;
      } else if (mediaRef.title) {
        originalFilename = mediaRef.title.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
      } else {
        originalFilename = 'image';
      }
      
      // Sanitize the original filename
      const safeOriginalFilename = originalFilename.replace(/[^a-zA-Z0-9_\-]/g, '_');
      
      // Format the new filename: file-<file id>-<original name>.png
      // Check if the cleanId already starts with 'file-' or 'file_' to avoid duplication or unwanted prefixing
      let fileIdWithPrefix;
      if (cleanId.startsWith('file-') || cleanId.startsWith('file_')) {
        // Already has appropriate prefix, use as is
        fileIdWithPrefix = cleanId;
      } else {
        // Add the file- prefix
        fileIdWithPrefix = `file-${cleanId}`;
      }
      return `${fileIdWithPrefix}-${safeOriginalFilename}.${ext}`;
    }
    
    // For non-PNG files, use the original naming logic
    // Create base name components
    let baseNameComponents = [];
    
    // Use title from message metadata if available
    if (mediaRef.title) {
      const safeTitle = mediaRef.title.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
      baseNameComponents.push(safeTitle);
    }
    
    // Use custom name (e.g., for DALL-E images) if available
    if (mediaRef.customName) {
      baseNameComponents.push(mediaRef.customName);
    } 
    // Otherwise use original filename if available (but without extension)
    else if (mediaRef.filename && mediaRef.filename.length > 0) {
      // Remove any extension from original filename
      const baseName = mediaRef.filename.includes('.')
        ? mediaRef.filename.substring(0, mediaRef.filename.lastIndexOf('.'))
        : mediaRef.filename;
        
      baseNameComponents.push(baseName);
    }
    
    // If we still don't have any components, use type and fileId
    if (baseNameComponents.length === 0) {
      const fileId = mediaRef.fileId || mediaRef.assetPointer || mediaRef.canvasId || 'file';
      // Extract just the ID from prefixed values like "sediment://file_123"
      const cleanId = fileId.includes('://') ? fileId.split('://').pop() : fileId;
      baseNameComponents.push(`${mediaRef.type}_${cleanId}`);
    }
    
    // Join all components and add extension
    const baseName = baseNameComponents.join('_');
    
    // Enforce max filename length
    const maxBaseNameLength = 50; // Safe length for most filesystems
    const safeBaseName = baseName.length > maxBaseNameLength 
      ? baseName.substring(0, maxBaseNameLength)
      : baseName;
    
    return `${safeBaseName}.${ext}`;
  }
  
  /**
   * Convert blob to data URL
   * @param {Blob} blob - Blob to convert
   * @returns {Promise<string>} Promise resolving to data URL
   */
  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to convert blob to data URL'));
      reader.readAsDataURL(blob);
    });
  }
  
  /**
   * Check if a blob contains valid binary data (not just JSON/text)
   * @param {Blob} blob - Blob to check
   * @returns {Promise<boolean>} Promise resolving to true if binary, false if text
   */
  async function isBinaryBlob(blob) {
    try {
      // Check the content type first
      // If it's clearly an image type, it's binary
      if (blob.type && (
        blob.type.includes('image/') || 
        blob.type.includes('audio/') || 
        blob.type.includes('video/') || 
        blob.type.includes('application/pdf')
      )) {
        return true;
      }
      
      // Read first 32 bytes
      const arrayBuffer = await blob.slice(0, 32).arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      // Check for magic numbers of common binary formats
      // JPEG: FF D8 FF
      if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
        return true;
      }
      
      // PNG: 89 50 4E 47
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        return true;
      }
      
      // GIF: 47 49 46 38
      if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
        return true;
      }
      
      // Check for JSON response, which is not binary data
      // JSON object starts with {
      if (bytes[0] === 0x7B) {
        return false;
      }
      // JSON array starts with [
      if (bytes[0] === 0x5B) {
        return false;
      }
      
      // If no magic number detected, check if it looks like text (JSON)
      // Count text vs. binary characters
      let textChars = 0;
      let binaryChars = 0;
      
      for (let i = 0; i < bytes.length; i++) {
        // ASCII printable characters (32-126) and common whitespace (9, 10, 13)
        if ((bytes[i] >= 32 && bytes[i] <= 126) || bytes[i] === 9 || bytes[i] === 10 || bytes[i] === 13) {
          textChars++;
        } else {
          binaryChars++;
        }
      }
      
      // If more than 90% are text characters, it's likely text
      return (textChars / (textChars + binaryChars)) < 0.9;
    } catch (e) {
      console.error('Error checking if blob is binary:', e);
      return false;
    }
  }
  
  /**
   * Download a blob as a file
   * @param {Blob} blob - Blob to download
   * @param {string} filename - Filename to use
   */
  async function downloadBlob(blob, filename) {
    try {
      // Check if the blob contains actual binary data or just JSON
      const isBinary = await isBinaryBlob(blob);
      
      // If it's not binary (likely just JSON), check for error responses
      if (!isBinary) {
        try {
          const text = await blob.text();
          try {
            const jsonData = JSON.parse(text);
            
            // Check if this JSON contains an error message
            if (jsonData.status === 'error' || jsonData.error || jsonData.error_code) {
              console.warn(`Warning: This file contains an error response: ${text}`);
              ExportConfig.error(`File "${filename}" contains error data:`, jsonData);
              
              // If the file has a PNG/JPG extension but contains JSON, fix the extension
              if (filename.match(/\.(jpg|jpeg|png|gif)$/i)) {
                const filenameParts = filename.split('.');
                filenameParts.pop(); // Remove the extension
                filename = filenameParts.join('.') + '.json';
                ExportConfig.log(`Renamed file to ${filename} since it contains JSON data`);
              }
            }
          } catch (e) {
            // Not valid JSON, but still not binary
            console.warn(`Warning: The file "${filename}" may not contain valid binary data (might be text).`);
          }
        } catch (e) {
          console.warn(`Failed to check content of ${filename}: ${e.message}`);
        }
      }
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      // Append to document, click, and remove
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (e) {
      console.error('Error downloading blob:', e);
      ExportConfig.error(`Failed to download ${filename}:`, e);
    }
  }
  
  /**
   * Download a blob to a specific folder path
   * @param {Blob} blob - Blob to download
   * @param {string} filePath - Path including folders and filename
   * @returns {Promise<boolean>} Promise resolving to true if successful
   */
  async function downloadBlobToPath(blob, filePath) {
    try {
      // Check if the blob contains actual binary data or just JSON
      const isBinary = await isBinaryBlob(blob);
      
      // If it's not binary (likely just JSON), check for error responses
      if (!isBinary) {
        try {
          const text = await blob.text();
          try {
            const jsonData = JSON.parse(text);
            
            // Check if this JSON contains an error message
            if (jsonData.status === 'error' || jsonData.error || jsonData.error_code) {
              console.warn(`Warning: This file contains an error response: ${text}`);
              ExportConfig.error(`File "${filePath}" contains error data:`, jsonData);
              
              // If the file has a PNG/JPG extension but contains JSON, fix the extension
              if (filePath.match(/\.(jpg|jpeg|png|gif)$/i)) {
                filePath = filePath.replace(/\.(jpg|jpeg|png|gif)$/i, '.json');
                ExportConfig.log(`Renamed file to ${filePath} since it contains JSON data`);
              }
            }
          } catch (e) {
            // Not valid JSON, but still not binary
            console.warn(`Warning: The file "${filePath}" may not contain valid binary data (might be text).`);
          }
        } catch (e) {
          console.warn(`Failed to check content of ${filePath}: ${e.message}`);
        }
      }
      
      // Create URL for the blob
      const url = URL.createObjectURL(blob);
      
      // Use chrome.downloads.download API to save the file to the specified path
      return new Promise((resolve, reject) => {
        if (typeof chrome !== 'undefined' && chrome.downloads) {
          chrome.downloads.download({
            url: url,
            filename: filePath, // This includes the folder structure
            saveAs: false // Don't show save dialog for each file
          }, (downloadId) => {
            // Revoke the URL after download starts
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
            if (chrome.runtime.lastError) {
              console.error('Download error:', chrome.runtime.lastError);
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            
            resolve(true);
          });
        } else {
          // Fallback to regular download if chrome.downloads API is not available
          const link = document.createElement('a');
          link.href = url;
          link.download = filePath.split('/').pop(); // Just the filename part
          
          // Append to document, click, and remove
          document.body.appendChild(link);
          link.click();
          
          // Clean up
          setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            resolve(true);
          }, 100);
        }
      });
    } catch (e) {
      console.error(`Error downloading blob to path ${filePath}:`, e);
      ExportConfig.error(`Failed to download to ${filePath}:`, e);
      return false;
    }
  }
  
  /**
   * Try to parse JSON from blob
   * @param {Blob} blob - Blob to check
   * @returns {Promise<Object|null>} Parsed JSON or null if not valid JSON
   */
  async function tryParseJson(blob) {
    try {
      const text = await blob.text();
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }
  
  /**
   * Fix file extension based on actual content
   * @param {string} filename - Original filename
   * @param {string} detectedType - Detected MIME type
   * @returns {string} Fixed filename
   */
  function fixFileExtension(filename, detectedType) {
    if (!filename || !detectedType) return filename;
    
    const baseName = filename.includes('.')
      ? filename.substring(0, filename.lastIndexOf('.'))
      : filename;
      
    const ext = getFileExtension(detectedType);
    
    return `${baseName}.${ext}`;
  }
  
  // Public API
  return {
    detectFileTypeFromBytes,
    getFileExtension,
    getAppropriateFileExtension,
    createSuitableFilename,
    blobToDataURL,
    isBinaryBlob,
    downloadBlob,
    downloadBlobToPath,
    tryParseJson,
    fixFileExtension
  };
})();

// No need to export - directly assigned to window.FileUtils above
console.log('FileUtils module loaded and attached to window', window.FileUtils);