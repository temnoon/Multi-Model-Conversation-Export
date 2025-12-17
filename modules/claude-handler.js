// Claude Export Handler - Text-First & Stable
window.ClaudeHandler = {
  extract: async function (statusCallback) {
    statusCallback("Scanning Claude UI...");

    const title = document.title || "Claude Chat";
    const messages = [];

    // 1. Target Main Chat Area
    // Claude's main chat usually has a class like "flex-1" or is a sibling to the sidebar nav.
    // We try to find the container that holds the messages.
    const chatContainer =
      document.querySelector("main") ||
      document.querySelector(".flex-1.overflow-auto") ||
      document.body;

    // 2. Find Message Blocks (Font-based)
    // We assume the font classes exist as they are standard Claude UI.
    let blocks = Array.from(
      chatContainer.querySelectorAll(
        ".font-user-message, .font-claude-message",
      ),
    );

    // Fallback: If fonts missing, look for the grid layout
    if (blocks.length === 0) {
      console.warn("Claude font classes not found. Using generic fallback.");
      blocks = Array.from(
        chatContainer.querySelectorAll(".grid.gap-2 .grid, .group.relative"),
      );
    }

    // Sort by vertical position
    blocks.sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
    );

    let msgIndex = 0;
    for (const block of blocks) {
      // FILTER: Sidebar Check
      // If this block is inside a sidebar container, skip it.
      // Sidebars often have widths like w-[260px] or specific background colors.
      if (block.closest("nav") || block.closest(".w-\\[260px\\]")) continue;

      // Determine Role
      let role = "model";
      if (block.classList.contains("font-user-message")) role = "user";
      else if (block.innerText.startsWith("User")) role = "user";

      // Get Text (this includes "Thinking" if it's expanded/visible in the block)
      const text = block.innerText.trim();
      if (!text) continue;

      // Check for separate "Thinking" blocks (sometimes separate divs)
      // If the user has expanded the thinking process, it might be in a sibling div.
      // We capture it as part of the text.

      messages.push({
        id: `msg_${msgIndex}`,
        role: role,
        content: { parts: [{ text: text }] },
        timestamp: Date.now() + msgIndex,
      });
      msgIndex++;
    }

    // 3. Return Clean Data (No Media for Claude)
    return {
      title: title,
      source: "Claude",
      messages: messages,
      media: [], // Explicitly empty to prevent errors
    };
  },
};
