// ==UserScript==
// @name        Messenger Hide Chat List
// @namespace   imxitiz's-Script
// @version     1.0
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
    let isResizing = false;
    let userDefinedFlexBasis =
        parseFloat(getLocalStorageItem("userDefinedFlexBasis")) || 30;
    let userResizedOnce =
        getSessionStorageItem("userResizedOnce") === "true" || false;

    // Helper functions for storage
    function setSessionStorageItem(key, value) {
        sessionStorage.setItem(key, value);
    }

    function getSessionStorageItem(key) {
        return sessionStorage.getItem(key);
    }

    function setLocalStorageItem(key, value) {
        localStorage.setItem(key, value);
    }

    function getLocalStorageItem(key) {
        return localStorage.getItem(key);
    }

    // Update sidebar visibility
    function updateSidebarVisibility() {
        const sidebar = document.querySelector('div[aria-label="Thread list"]');
        const inboxSwitcher = document.querySelector(
            'div[aria-label="Inbox switcher"]'
        );

        if (sidebar && inboxSwitcher) {
            if (!hasInitialized) {
                sidebar.style.maxWidth = "0"; // Initial max-width
                sidebar.style.minWidth = "0"; // Ensure consistent width
                sidebar.style.margin = "0";
                hasInitialized = true;

                setTimeout(() => {
                    // Create and append the resize handle
                    const resizeHandle = document.createElement("div");
                    resizeHandle.id = "resize-handle";
                    resizeHandle.style.width = "10px";
                    resizeHandle.style.height = "100%";
                    resizeHandle.style.position = "absolute";
                    resizeHandle.style.top = "0";
                    resizeHandle.style.right = "0";
                    resizeHandle.style.cursor = "ew-resize";
                    resizeHandle.style.backgroundColor = userResizedOnce
                        ? "transparent"
                        : "red";
                    resizeHandle.style.zIndex = "1000";
                    const sidebar = document.querySelector(
                        'div[aria-label="Thread list"]'
                    );
                    sidebar.appendChild(resizeHandle);

                    // Start resizing when the user clicks on the resize handle
                    resizeHandle.addEventListener("mousedown", function () {
                        isResizing = true;
                        document.addEventListener("mousemove", resizeChatList);
                        document.addEventListener("mouseup", stopResize);
                    });
                }, 5000);
            }
            const isMouseOverSidebar =
                isMouseOver(sidebar) || isMouseOver(inboxSwitcher);

            if (
                isMouseOverSidebar ||
                eventParent.clientX <= hideThreshold ||
                isResizing
            ) {
                // Show sidebar
                sidebar.style.maxWidth = `${userDefinedFlexBasis}%`; // Set max-width to its original value
                sidebar.style.minWidth = `${userDefinedFlexBasis}%`; // Ensure min-width to maintain space
                sidebar.style.margin = "0";
            } else {
                // Hide sidebar
                sidebar.style.maxWidth = "0"; // Collapse max-width to zero
                sidebar.style.minWidth = "0"; // Ensure min-width to collapse space
            }
        }
    }

    // Resize the chat list while the mouse is moving
    function resizeChatList(e) {
        if (isResizing) {
            const sidebar = document.querySelector(
                'div[aria-label="Thread list"]'
            );
            const containerWidth = sidebar.parentElement.clientWidth;
            let newFlexBasis =
                ((e.clientX - sidebar.getBoundingClientRect().left) /
                    containerWidth) *
                100;

            if (newFlexBasis >= 10 && newFlexBasis <= 100) {
                userDefinedFlexBasis = newFlexBasis;
                sidebar.style.maxWidth = `${userDefinedFlexBasis}%`; // Set max-width to its original value
                sidebar.style.minWidth = `${userDefinedFlexBasis}%`; // Ensure min-width to maintain space
            }

            if (!userResizedOnce) {
                userResizedOnce = true;
                setSessionStorageItem("userResizedOnce", "true");
                let resizeHandle = document.getElementById("resize-handle");
                resizeHandle.style.backgroundColor = "transparent";
                // Optionally use a tooltip or status message instead of an alert
                alert(
                    "Resize handle color changed to transparent from red. You can now resize the chat list by dragging from the right edge of the chat list."
                );
            }
            setLocalStorageItem("userDefinedFlexBasis", userDefinedFlexBasis);
        }
    }

    // Stop resizing when the mouse button is released
    function stopResize() {
        isResizing = false;
        document.removeEventListener("mousemove", resizeChatList);
        document.removeEventListener("mouseup", stopResize);
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
