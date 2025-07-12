// ==UserScript==
// @name        Grok Chat Workspace Icon Sync
// @namespace   imxitiz's-Script
// @version     1.0
// @grant       none
// @license     GNU GPLv3
// @author      imxitiz
// @contributor imxitiz
// @match       https://grok.com/chat/*
// @description Automatically syncs and displays workspace icons next to chat history items on Grok Chat. Includes features for mapping, storing, and visually enhancing chat navigation with workspace icons.
// ==/UserScript==

(function () {
  'use strict';

  // Initialize or load icon map from localStorage
  let iconMap = JSON.parse(localStorage.getItem('chatIcons') || '{}');
  let iconMapChanged = false;

  // Function to update icon map with new workspace icons
  function updateIconMap() {
    const workspaceLink = document.querySelector('a[href^="/workspace/"]');
    if (workspaceLink) {
      const chatId = location.pathname.split('/')[2];
      const iconSvg = workspaceLink.querySelector('svg');
      if (iconSvg && !iconMap[chatId]) {
        const iconHtml = iconSvg.outerHTML;
        iconMap[chatId] = iconHtml;
        localStorage.setItem('chatIcons', JSON.stringify(iconMap));
        iconMapChanged = true;
      }
    }
  }

  // Function to apply icons to chat items
  function applyIcons() {
    if (iconMapChanged) {
      iconMap = JSON.parse(localStorage.getItem('chatIcons') || '{}');
      iconMapChanged = false; // Reset immediately after use
    }
    const chatItems = document.querySelectorAll('a[href^="/chat/"]');
    chatItems.forEach(chat => {
      const chatId = chat.getAttribute('href').split('/')[2];
      const chatTextSpan = chat.querySelector('span');
      if (chatTextSpan && chatTextSpan.parentNode && iconMap[chatId] && !chatTextSpan.querySelector('.icon-added')) {
        const iconElement = document.createElement('span');
        iconElement.className = 'icon-added';
        iconElement.innerHTML = iconMap[chatId];
        iconElement.style.display = 'inline-block';
        iconElement.style.marginRight = '5px';
        iconElement.style.verticalAlign = 'middle';
        chatTextSpan.insertBefore(iconElement, chatTextSpan.firstChild);
      }
    });
  }

  // Main sync function combining both steps
  function syncIcons() {
    updateIconMap();
    applyIcons();
  }

  // Run after full page load with a delay for DOM stability
  window.onload = function () {
    setTimeout(syncIcons, 3000); // 3000ms delay to ensure full render
  };

  // Handle URL changes with a delay for dynamic content
  window.addEventListener('popstate', () => {
    setTimeout(syncIcons, 5000); // 5000ms delay to ensure DOM stability
  });

  setInterval(applyIcons, 2000); // Every 2 seconds, adjust as needed

  // Periodic check for real-time updates
  setInterval(syncIcons, 10000); // Every 10 seconds, adjust as needed
})();