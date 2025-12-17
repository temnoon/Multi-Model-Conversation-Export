// ChatGPT Chat Log Export - UI Module

/**
 * UI Module
 * Provides functions for creating and managing UI elements
 */
window.UIManager = (() => {
  // Track UI elements
  const uiElements = {
    buttonContainer: null,
    statusUI: null
  };
  
  /**
   * Get the URL for the download icon
   * @returns {string} Icon URL
   */
  function getIconURL() {
    // First try getting the SVG icon from extension resources
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        return chrome.runtime.getURL('icons/download-icon.min.svg');
      } catch (e) {
        ExportConfig.error('Error getting icon URL:', e);
      }
    }
    
    // Fallback to a simple data URL if extension resource fails
    return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJmZWF0aGVyIGZlYXRoZXItZG93bmxvYWQiPjxwYXRoIGQ9Ik0yMSAxNXY0YTIgMiAwIDAgMS0yIDJINWEyIDIgMCAwIDEtMi0ydi00Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iNyAxMCAxMiAxNSAxNyAxMCI+PC9wb2x5bGluZT48bGluZSB4MT0iMTIiIHkxPSIxNSIgeDI9IjEyIiB5Mj0iMyI+PC9saW5lPjwvc3ZnPg==';
  }
  
  /**
   * Add export button to the UI
   * @param {Function} clickHandler - Function to call when button is clicked
   */
  function addExportButton(clickHandler) {
    // Check if button already exists
    if (document.querySelector('.chatgpt-export-button-container')) {
      return;
    }
    
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'chatgpt-export-button-container';
    buttonContainer.style.position = 'fixed';
    buttonContainer.style.zIndex = '1000';
    buttonContainer.style.top = ExportConfig.ui.buttonPosition.top;
    buttonContainer.style.right = ExportConfig.ui.buttonPosition.right;
    
    // Create the button
    const exportButton = document.createElement('button');
    exportButton.className = 'chatgpt-export-button';
    exportButton.title = 'Export Chat Log with Media';
    exportButton.style.fontSize = '24px';
    exportButton.style.padding = '10px';
    exportButton.style.borderRadius = '50%';
    exportButton.style.backgroundColor = ExportConfig.ui.colors.primary;
    exportButton.style.color = ExportConfig.ui.colors.textLight;
    exportButton.style.border = 'none';
    exportButton.style.cursor = 'pointer';
    exportButton.style.width = '50px';
    exportButton.style.height = '50px';
    exportButton.style.display = 'flex';
    exportButton.style.alignItems = 'center';
    exportButton.style.justifyContent = 'center';
    exportButton.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.2)';
    
    // Get SVG icon URL and create image element
    const iconURL = getIconURL();
    const iconImage = document.createElement('img');
    iconImage.src = iconURL;
    iconImage.alt = 'Download';
    iconImage.style.width = '24px';
    iconImage.style.height = '24px';
    iconImage.style.filter = 'invert(1)'; // Make icon white
    
    // Add image to button
    exportButton.appendChild(iconImage);
    
    // Add hover effect
    exportButton.onmouseover = () => {
      exportButton.style.backgroundColor = ExportConfig.ui.colors.primaryHover;
      exportButton.style.transform = 'scale(1.05)';
    };
    
    exportButton.onmouseout = () => {
      exportButton.style.backgroundColor = ExportConfig.ui.colors.primary;
      exportButton.style.transform = 'scale(1)';
    };
    
    // Add click handler
    exportButton.onclick = clickHandler;
    
    // Add button to container and page
    buttonContainer.appendChild(exportButton);
    document.body.appendChild(buttonContainer);
    
    // Store reference to the button container
    uiElements.buttonContainer = buttonContainer;
    
    ExportConfig.log('Export button added to the page');
  }
  
  /**
   * Remove export button from the UI
   */
  function removeExportButton() {
    const buttonContainer = document.querySelector('.chatgpt-export-button-container');
    if (buttonContainer) {
      buttonContainer.remove();
      uiElements.buttonContainer = null;
      ExportConfig.log('Export button removed from the page');
    }
  }
  
  /**
   * Create status UI for export progress
   * @returns {Object} Status UI object with updateStatus function
   */
  function createStatusUI() {
    // Remove existing status UI if any
    if (uiElements.statusUI && uiElements.statusUI.parentNode) {
      document.body.removeChild(uiElements.statusUI);
    }
    
    // Create status container
    const statusUI = document.createElement('div');
    statusUI.className = 'chatgpt-export-status';
    statusUI.style.position = 'fixed';
    statusUI.style.bottom = '20px';
    statusUI.style.right = '20px';
    statusUI.style.backgroundColor = 'white';
    statusUI.style.border = '1px solid #ccc';
    statusUI.style.borderRadius = '8px';
    statusUI.style.padding = '10px';
    statusUI.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    statusUI.style.zIndex = '10000';
    statusUI.style.maxWidth = '300px';
    statusUI.style.fontSize = '14px';
    statusUI.innerHTML = '<div style="font-weight: bold; margin-bottom: 5px;">Export Status</div><div id="export-status-message">Initializing export...</div>';
    document.body.appendChild(statusUI);
    
    // Store reference to the status UI
    uiElements.statusUI = statusUI;
    
    // Create status updater function
    const updateStatus = (message) => {
      const statusMessage = statusUI.querySelector('#export-status-message');
      if (statusMessage) {
        statusMessage.textContent = message;
      }
      ExportConfig.log(`Status: ${message}`);
    };
    
    ExportConfig.log('Status UI created');
    
    return {
      element: statusUI,
      updateStatus
    };
  }
  
  /**
   * Remove status UI
   */
  function removeStatusUI() {
    if (uiElements.statusUI && uiElements.statusUI.parentNode) {
      document.body.removeChild(uiElements.statusUI);
      uiElements.statusUI = null;
      ExportConfig.log('Status UI removed');
    }
  }
  
  /**
   * Show an alert message
   * @param {string} message - Message to show
   * @param {string} type - Alert type (success, error, info)
   */
  function showAlert(message, type = 'info') {
    let backgroundColor = '#f0f0f0';
    let textColor = '#000000';
    
    switch (type) {
      case 'success':
        backgroundColor = '#d4edda';
        textColor = '#155724';
        break;
      case 'error':
        backgroundColor = '#f8d7da';
        textColor = '#721c24';
        break;
      case 'info':
        backgroundColor = '#d1ecf1';
        textColor = '#0c5460';
        break;
    }
    
    const alertDiv = document.createElement('div');
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.left = '50%';
    alertDiv.style.transform = 'translateX(-50%)';
    alertDiv.style.padding = '10px 20px';
    alertDiv.style.backgroundColor = backgroundColor;
    alertDiv.style.color = textColor;
    alertDiv.style.borderRadius = '5px';
    alertDiv.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    alertDiv.style.zIndex = '10001';
    alertDiv.textContent = message;
    
    document.body.appendChild(alertDiv);
    
    // Remove after 5 seconds
    setTimeout(() => {
      if (alertDiv.parentNode) {
        document.body.removeChild(alertDiv);
      }
    }, 5000);
  }
  
  // Public API
  return {
    addExportButton,
    removeExportButton,
    createStatusUI,
    removeStatusUI,
    showAlert
  };
})();

// No need to export - directly assigned to window.UIManager above
console.log('UIManager module loaded and attached to window', window.UIManager);