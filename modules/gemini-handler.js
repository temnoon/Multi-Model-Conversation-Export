// Gemini Export Handler - Text-First & Stable
window.GeminiHandler = {
  extract: async function (statusCallback) {
    statusCallback("Scanning Gemini UI...");

    // 1. Get Title
    let title = "Gemini Chat";
    const titleEl =
      document.querySelector('[data-test-id="conversation-title"]') ||
      document.querySelector(".conversation-title") ||
      document.querySelector("h1");
    if (titleEl && titleEl.innerText.trim()) title = titleEl.innerText.trim();

    // 2. Identify Chat Root (Strict)
    // We strictly look for the main content area to avoid the sidebar completely.
    const chatContainer =
      document.querySelector("main") ||
      document.querySelector('[role="main"]') ||
      document.querySelector("infinite-scroller");

    if (!chatContainer) {
      throw new Error(
        "Could not locate chat area. Please ensure the chat is fully loaded.",
      );
    }

    // 3. Scan for Message Blocks
    // We look for all text-containing blocks inside the CHAT CONTAINER only.
    const allElements = Array.from(
      chatContainer.querySelectorAll(
        "p, li, .model-response-text, .user-query-text",
      ),
    );

    // Filter for valid message parts
    const messageNodes = allElements.filter((el) => {
      // Double-check: Ensure we aren't in a nested nav/menu (just in case)
      if (el.closest("nav") || el.closest('[role="navigation"]')) return false;

      const text = el.innerText.trim();
      if (!text) return false;

      // Filter UI Noise
      const noise = [
        "Expand",
        "Collapse",
        "Listen",
        "Share",
        "Google",
        "Sources",
        "View other drafts",
      ];
      if (noise.includes(text)) return false;

      // Filter small labels that aren't user input
      if (text.length < 3 && !el.closest('[data-test-id*="user"]'))
        return false;

      return true;
    });

    // 4. Group into Messages
    const messages = [];
    let msgIndex = 0;

    // We iterate through the filtered text nodes
    for (const node of messageNodes) {
      const text = node.innerText.trim();

      // Determine Role
      // Default to model. If we find user indicators nearby, switch to user.
      let role = "model";
      let parent = node.parentElement;

      // Walk up 6 levels looking for "User" markers
      for (let i = 0; i < 6; i++) {
        if (!parent) break;
        const html = parent.innerHTML;
        if (
          html.includes("edit_note") ||
          parent.querySelector('mat-icon[data-mat-icon-name="pencil"]') ||
          parent.getAttribute("data-test-id")?.includes("user")
        ) {
          role = "user";
          break;
        }
        parent = parent.parentElement;
      }

      // Check if this is a "Thinking" block
      // (Gemini sometimes labels these or puts them in specific containers)
      if (text.startsWith("Thinking") && text.length < 20) {
        // This is likely just the label "Thinking", skip it unless it has content
        continue;
      }

      messages.push({
        id: `msg_${msgIndex}`,
        role: role,
        content: { parts: [{ text: text }] },
        timestamp: Date.now() + msgIndex,
      });
      msgIndex++;
    }

    // 5. Return Clean Data (No Media for Gemini)
    return {
      title: title,
      source: "Gemini",
      messages: messages,
      media: [], // Explicitly empty to prevent errors
    };
  },
};
