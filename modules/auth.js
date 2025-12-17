// ChatGPT Chat Log Export - Authentication Module

/**
 * Authentication Module
 * Handles authentication and token management
 */
window.AuthManager = (() => {
  // Session cache to avoid repeated auth calls
  const sessionCache = {
    token: null,
    expiry: null,
    tokenEncryptionKey: null,
  };

  /**
   * Generate a random key for token encryption
   * @param {number} length - Length of the key
   * @returns {string} Random key
   */
  function generateRandomKey(length = 32) {
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, (x) => charset[x % charset.length]).join("");
  }

  /**
   * Encrypt a token with a key
   * @param {string} token - Token to encrypt
   * @param {string} key - Encryption key
   * @returns {string} Encrypted token
   */
  function encryptToken(token, key) {
    let encrypted = "";
    for (let i = 0; i < token.length; i++) {
      let charCode = token.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      encrypted += String.fromCharCode(charCode);
    }
    return encrypted;
  }

  /**
   * Decrypt a token with a key
   * @param {string} token - Token to decrypt
   * @param {string} key - Encryption key
   * @returns {string} Decrypted token
   */
  function decryptToken(token, key) {
    let decrypted = "";
    for (let i = 0; i < token.length; i++) {
      let charCode = token.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      decrypted += String.fromCharCode(charCode);
    }
    return decrypted;
  }

  /**
   * Initialize the authentication manager
   */
  function initialize() {
    // Initialize encryption key on load if not already set
    if (!sessionCache.tokenEncryptionKey) {
      sessionCache.tokenEncryptionKey = generateRandomKey();
      if (typeof ExportConfig !== "undefined") {
        ExportConfig.log("Generated encryption key for session token");
      }
    }
  }

  /**
   * Get an access token for API requests
   * @returns {Promise<string>} Promise resolving to the access token
   */
  async function getAccessToken() {
    // Check if we have a valid cached token
    const now = Date.now();
    if (
      sessionCache.token &&
      sessionCache.expiry &&
      now < sessionCache.expiry
    ) {
      ExportConfig.log("Using cached access token");
      return decryptToken(sessionCache.token, sessionCache.tokenEncryptionKey);
    }

    ExportConfig.log("Fetching new access token");

    try {
      // Determine the current domain
      const domain = window.location.hostname;

      // Try using background script if available
      if (typeof chrome !== "undefined" && chrome.runtime) {
        try {
          const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage(
              {
                action: "getAuthToken",
                domain: domain,
              },
              (res) => {
                // Handle callback manually to avoid promise issues in some envs
                if (chrome.runtime.lastError) {
                  resolve(null);
                } else {
                  resolve(res);
                }
              },
            );
          });

          // FIX: Check if response exists before accessing properties
          if (response && response.success && response.token) {
            // Encrypt and cache the token
            sessionCache.token = encryptToken(
              response.token,
              sessionCache.tokenEncryptionKey,
            );
            // Set expiry to 10 minutes from now (conservative)
            sessionCache.expiry = now + 10 * 60 * 1000;

            return response.token;
          }
        } catch (e) {
          ExportConfig.log(
            "Error using background script for auth, falling back to direct fetch:",
            e,
          );
          // Fall back to direct fetch if the background script fails
        }
      }

      // Direct fetch fallback
      const response = await fetch(`https://${domain}/api/auth/session`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "*/*",
          "Accept-Language": navigator.language,
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error(`Authentication failed with status ${response.status}`);
      }

      const data = await response.json();

      if (!data.accessToken) {
        throw new Error("No access token found in response");
      }

      // Encrypt and cache the token
      sessionCache.token = encryptToken(
        data.accessToken,
        sessionCache.tokenEncryptionKey,
      );
      // Set expiry to 10 minutes from now (conservative)
      sessionCache.expiry = now + 10 * 60 * 1000;

      return data.accessToken;
    } catch (error) {
      ExportConfig.error("Error getting access token:", error);
      throw error;
    }
  }

  /**
   * Clear cached token
   */
  function clearCachedToken() {
    sessionCache.token = null;
    sessionCache.expiry = null;
    ExportConfig.log("Cleared cached token");
  }

  // Initialize on module load
  initialize();

  // Public API
  return {
    getAccessToken,
    clearCachedToken,
  };
})();

// No need to export - directly assigned to window.AuthManager above
console.log(
  "AuthManager module loaded and attached to window",
  window.AuthManager,
);
