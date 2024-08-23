// ==UserScript==
// @name        Messenger Hide Chat List
// @namespace   imxitiz's-Script
// @version     0.1
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
                sidebar.style.flex = "0 0 20%";
                sidebar.style.transition = "flex .5s ease-out 0s";
                hasInitialized = true;
            }
            const isMouseOverSidebar =
                isMouseOver(sidebar) || isMouseOver(inboxSwitcher);

            if (isMouseOverSidebar || eventParent.clientX <= hideThreshold) {
                // Show sidebar
                sidebar.style.transition = "flex .5s ease-out 0s";
                sidebar.style.flex = "0 0 20%";
            } else {
                // Hide sidebar
                sidebar.style.transition = "flex .5s ease-out 0s";
                sidebar.style.flex = "0 0 0%";
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
