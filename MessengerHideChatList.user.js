// ==UserScript==
// @name        Messenger Hide Chat List
// @namespace   imxitiz's-Script
// @version     0.2
// @grant       none
// @license     GNU GPLv3
// @author      imxitiz
// @match       https://www.messenger.com/*
// @description Hide Messenger Web chat list
// @downloadURL https://update.greasyfork.org/scripts/503623/Messenger%20Hide%20Chat%20List.user.js
// @updateURL   https://update.greasyfork.org/scripts/503623/Messenger%20Hide%20Chat%20List.meta.js
// ==/UserScript==

(function () {
    "use strict";

    let hasInitialized = false;
    const hideThreshold = 20;
    let eventParent;

    // Update sidebar visibility
    function updateSidebarVisibility() {
        const sidebar = document.querySelector('div[aria-label="Thread list"]');
        const inboxSwitcher = document.querySelector(
            'div[aria-label="Inbox switcher"]'
        );

        if (sidebar && inboxSwitcher) {
            if (!hasInitialized) {
                sidebar.style.transition = "max-width .5s ease-out";
                sidebar.style.maxWidth = "0"; // Initial max-width
                sidebar.style.minWidth = "0"; // Ensure consistent width
                sidebar.style.margin = "0";
                hasInitialized = true;
            }
            const isMouseOverSidebar =
                isMouseOver(sidebar) || isMouseOver(inboxSwitcher);

            if (isMouseOverSidebar || eventParent.clientX <= hideThreshold) {
                // Show sidebar
                sidebar.style.maxWidth = "21%"; // Set max-width to its original value
                sidebar.style.minWidth = "21%"; // Ensure min-width to maintain space
            } else {
                // Hide sidebar
                sidebar.style.maxWidth = "0"; // Collapse max-width to zero
                sidebar.style.minWidth = "0"; // Ensure min-width to collapse space
            }
        }
    }

    // Check if mouse is over the element or its children
    function isMouseOver(element) {
        return element.contains(eventParent.target);
    }

    // Set up MutationObserver
    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.type === "childList") {
                // If there are added nodes, update the sidebar visibility
                if (mutation.addedNodes.length > 0) {
                    updateSidebarVisibility();
                }
            }
        });
    });

    // Start observing the document for changes
    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    // Initialize the script
    function init() {
        document.addEventListener("mousemove", function (event) {
            eventParent = event;
            updateSidebarVisibility();
        });
    }

    init();
})();
