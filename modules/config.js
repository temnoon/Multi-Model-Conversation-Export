// ChatGPT Chat Log Export - Configuration Module

/**
 * Configuration Module
 * Contains all configuration settings for the extension
 */
const Config = {
  // Debug mode
  debug: true,
  
  // Supported domains
  domains: ['chat.openai.com', 'chatgpt.com'],
  
  // Sediment regions - used for constructing sediment file URLs
  sedimentRegions: [
    'westus2', 
    'westus3', 
    'centralus', 
    'eastus',
    'eastus2',
    'northcentralus',
    'southcentralus',
    'northeurope',
    'westeurope',
    'australiaeast',
    'southeastasia',
    'eastasia',
    'centralindia'
  ],
  
  // UI configurations
  ui: {
    buttonPosition: { top: '80px', right: '15px' },
    colors: {
      primary: '#10a37f', // ChatGPT green
      primaryHover: '#0d8c6d',
      textLight: 'white'
    }
  },
  
  // File type mappings
  fileTypes: {
    // Images
    'image/png': { ext: 'png', type: 'image' },
    'image/jpeg': { ext: 'jpg', type: 'image' },
    'image/gif': { ext: 'gif', type: 'image' },
    'image/webp': { ext: 'webp', type: 'image' },
    'image/bmp': { ext: 'bmp', type: 'image' },
    'image/tiff': { ext: 'tiff', type: 'image' },
    'image/svg+xml': { ext: 'svg', type: 'image' },
    
    // Audio
    'audio/mpeg': { ext: 'mp3', type: 'audio' },
    'audio/mp3': { ext: 'mp3', type: 'audio' },
    'audio/ogg': { ext: 'ogg', type: 'audio' },
    'audio/wav': { ext: 'wav', type: 'audio' },
    'audio/x-wav': { ext: 'wav', type: 'audio' },
    'audio/x-m4a': { ext: 'm4a', type: 'audio' },
    'audio/aac': { ext: 'aac', type: 'audio' },
    'audio/flac': { ext: 'flac', type: 'audio' },
    
    // Video
    'video/mp4': { ext: 'mp4', type: 'video' },
    'video/webm': { ext: 'webm', type: 'video' },
    'video/quicktime': { ext: 'mov', type: 'video' },
    'video/x-msvideo': { ext: 'avi', type: 'video' },
    'video/x-matroska': { ext: 'mkv', type: 'video' },
    
    // Documents
    'application/json': { ext: 'json', type: 'document' },
    'application/pdf': { ext: 'pdf', type: 'document' },
    'application/zip': { ext: 'zip', type: 'document' },
    'application/x-zip-compressed': { ext: 'zip', type: 'document' },
    'application/msword': { ext: 'doc', type: 'document' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', type: 'document' },
    'application/vnd.ms-excel': { ext: 'xls', type: 'document' },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'xlsx', type: 'document' },
    'application/vnd.ms-powerpoint': { ext: 'ppt', type: 'document' },
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': { ext: 'pptx', type: 'document' },
    
    // Text
    'text/plain': { ext: 'txt', type: 'document' },
    'text/html': { ext: 'html', type: 'document' },
    'text/css': { ext: 'css', type: 'document' },
    'text/javascript': { ext: 'js', type: 'document' },
    'text/csv': { ext: 'csv', type: 'document' },
    'text/xml': { ext: 'xml', type: 'document' },
    'application/xml': { ext: 'xml', type: 'document' },
    'application/javascript': { ext: 'js', type: 'document' }
  },
  
  // Default media types
  defaultFileTypes: {
    'image': { ext: 'jpg', type: 'image/jpeg' },
    'audio': { ext: 'mp3', type: 'audio/mpeg' },
    'video': { ext: 'mp4', type: 'video/mp4' },
    'file': { ext: 'bin', type: 'application/octet-stream' },
    'canvas': { ext: 'json', type: 'application/json' }
  },
  
  // Log a debug message if debug mode is enabled
  log(...args) {
    if (this.debug) {
      console.log('[ChatGPT Export]', ...args);
    }
  },
  
  // Log an error message
  error(...args) {
    console.error('[ChatGPT Export]', ...args);
  }
};

// Export the module for use in other files
window.ExportConfig = Config;