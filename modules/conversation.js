// ChatGPT Chat Log Export - Conversation Utilities Module

/**
 * Conversation Module
 * Provides functions for working with ChatGPT conversations
 */
window.ConversationManager = (() => {
  /**
   * Get the conversation ID from the URL
   * @returns {string|null} Conversation ID or null if not found
   */
  function getConversationId() {
    // Try different URL patterns
    const patterns = [
      /\/(c|chat)\/([\w-]{36})/,  // Matches both /c/ and /chat/ paths with 36-char IDs
      /\/(c|chat)\/([\w-]+)/      // Fallback for any other format
    ];
    
    for (const pattern of patterns) {
      const match = window.location.pathname.match(pattern);
      if (match && match[2]) {
        return match[2];
      }
    }
    
    return null;
  }
  
  /**
   * Fetch the complete conversation data from the API
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object>} Promise resolving to the conversation data
   */
  async function getConversation(conversationId) {
    ExportConfig.log(`Fetching conversation data for ID: ${conversationId}`);
    
    try {
      const token = await AuthManager.getAccessToken();
      const domain = window.location.hostname;
      
      const response = await fetch(`https://${domain}/backend-api/conversation/${conversationId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': '*/*',
          'Accept-Language': navigator.language,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch conversation: ${response.status}`);
      }
      
      const data = await response.json();
      
      ExportConfig.log('Successfully fetched conversation data');
      
      return data;
      
    } catch (error) {
      ExportConfig.error('Error fetching conversation:', error);
      throw error;
    }
  }
  
  /**
   * Check if the current page is a valid ChatGPT conversation page
   * @returns {boolean} True if valid, false otherwise
   */
  function isValidChatGPTPage() {
    // Check hostname
    if (!ExportConfig.domains.includes(window.location.hostname)) {
      return false;
    }
    
    // Check if we have a conversation page
    return window.location.pathname.includes('/c/') || 
           window.location.pathname.includes('/chat/');
  }
  
  /**
   * Export the conversation as JSON
   * @param {Object} conversationData - Conversation data
   * @returns {Promise<void>} Promise that resolves when done
   */
  async function exportConversationJson(conversationData) {
    ExportConfig.log('Exporting conversation as JSON');
    
    const conversationId = conversationData.id || conversationData.conversation_id || getConversationId();
    
    // Create JSON blob
    const json = JSON.stringify(conversationData, null, 2);
    const jsonBlob = new Blob([json], { type: 'application/json' });
    
    // Create a folder name based on conversation data
    const folderName = createConversationFolderName(conversationData);
    
    // Download the JSON file to the folder
    const jsonFilePath = `${folderName}/conversation.json`;
    await FileUtils.downloadBlobToPath(jsonBlob, jsonFilePath);
    
    ExportConfig.log(`Conversation JSON exported successfully to ${jsonFilePath}`);
  }
  
  /**
   * Create a folder name based on conversation data
   * @param {Object} conversationData - The conversation data
   * @returns {string} Folder name
   */
  function createConversationFolderName(conversationData) {
    if (!conversationData) return 'chatgpt_export';
    
    let title = 'Untitled Conversation';
    let id = '';
    let dateStr = '';
    
    // Extract title
    if (conversationData.title) {
      title = conversationData.title;
    }
    
    // Extract ID
    if (conversationData.id) {
      id = conversationData.id;
    } else if (conversationData.conversation_id) {
      id = conversationData.conversation_id;
    }
    
    // Extract date
    let date = new Date();
    if (conversationData.create_time) {
      date = new Date(conversationData.create_time * 1000);
    } else if (conversationData.update_time) {
      date = new Date(conversationData.update_time * 1000);
    }
    
    // Format date as YYYY-MM-DD
    dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    // Clean up title for folder name
    const safeTitle = title.replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_');
    
    // Create folder name: Title_YYYY-MM-DD_ID
    return `${safeTitle}_${dateStr}_${id}`.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  }
  
  // Public API
  return {
    getConversationId,
    getConversation,
    isValidChatGPTPage,
    exportConversationJson,
    createConversationFolderName
  };
})();

// No need to export - directly assigned to window.ConversationManager above
console.log('ConversationManager module loaded and attached to window', window.ConversationManager);