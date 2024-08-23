// ==UserScript==
// @name        Messenger Hide Chat List
// @namespace   imxitiz's-Script
// @version     2.0
// @grant       none
// @license     GNU GPLv3
// @author      imxitiz
// @match       https://www.messenger.com/*
// @description Hide Messenger Web chat list
// @downloadURL https://update.greasyfork.org/scripts/503623/Messenger%20Hide%20Chat%20List.user.js
// @updateURL   https://update.greasyfork.org/scripts/503623/Messenger%20Hide%20Chat%20List.meta.js
// ==/UserScript==

(function () {
    ("use strict");

    let hasInitialized = false;
    const hideThreshold = 20; // Threshold in pixels to determine if sidebar should be hidden
    let eventParent;
    let isResizing = false;
    let userDefinedFlexBasis =
        parseFloat(getLocalStorageItem("userDefinedFlexBasis")) || 30;
    let userResizedOnce =
        getSessionStorageItem("userResizedOnce") === "true" || false;
    let active = parseInt(getSessionStorageItem("active")) || 0;
    // active states:
    // 0 - Normal behavior: sidebar hidden on hover
    // 1 - Always visible
    // 2 - Always hidden
    let lockPosition = JSON.parse(getSessionStorageItem("lockPosition")) || {
        x: 0,
        y: 0,
    };
    const clickThreshold = 80; // Threshold in pixels for precise unlocking
    let wrongLockedPlaceAttempt = 0;

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

    // Create and append the resize handle to the sidebar
    function createResizeHandle() {
        try {
            const sidebar = document.querySelector(
                'div[aria-label="Thread list"]'
            );
            if (!sidebar) {
                throw new Error("Sidebar element not found");
            }

            // Create resize handle only if it doesn't already exist
            if (!document.getElementById("resize-handle")) {
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
                sidebar.appendChild(resizeHandle);

                // Add event listeners for resizing
                resizeHandle.addEventListener("mousedown", function () {
                    isResizing = true;
                    document.addEventListener("mousemove", resizeChatList);
                    document.addEventListener("mouseup", stopResize);
                });
            }
        } catch (error) {
            console.error("Error creating resize handle: ", error);
            setTimeout(createResizeHandle, 1000); // Retry after 1 second if there's an error
        }
    }

    // Update sidebar visibility based on user interactions and settings
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

                createResizeHandle(); // Create resize handle on initial setup
            }
            const isMouseOverSidebar =
                isMouseOver(sidebar) || isMouseOver(inboxSwitcher);

            if (active === 1) {
                // Always show the sidebar
                sidebar.style.maxWidth = `${userDefinedFlexBasis}%`;
                sidebar.style.minWidth = `${userDefinedFlexBasis}%`;
                sidebar.style.margin = "0";
            } else if (active === 2) {
                // Always hide the sidebar
                sidebar.style.maxWidth = "0";
                sidebar.style.minWidth = "0";
            } else {
                // Normal behavior
                if (
                    isMouseOverSidebar ||
                    eventParent.clientX <= hideThreshold ||
                    isResizing
                ) {
                    // Show sidebar
                    sidebar.style.maxWidth = `${userDefinedFlexBasis}%`;
                    sidebar.style.minWidth = `${userDefinedFlexBasis}%`;
                    sidebar.style.margin = "0";
                } else {
                    // Hide sidebar
                    sidebar.style.maxWidth = "0";
                    sidebar.style.minWidth = "0";
                }
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
                sidebar.style.maxWidth = `${userDefinedFlexBasis}%`;
                sidebar.style.minWidth = `${userDefinedFlexBasis}%`;
            }

            if (!userResizedOnce) {
                userResizedOnce = true;
                setSessionStorageItem("userResizedOnce", "true");
                let resizeHandle = document.getElementById("resize-handle");
                resizeHandle.style.backgroundColor = "transparent";
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

    // Calculate distance between two points
    function calculateDistance(pos1, pos2) {
        return Math.sqrt(
            Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2)
        );
    }

    // Check if mouse is near the locked position
    function isNearLockPosition(x, y, lockPosition) {
        const distance = calculateDistance(lockPosition, { x, y });
        return distance <= clickThreshold;
    }

    // Helper function to show notifications
    function showNotification(message, time = 5000) {
        const notification = document.createElement("div");
        notification.textContent = message;
        notification.style.position = "fixed";
        notification.style.top = "50%";
        notification.style.left = "50%";
        notification.style.transform = "translate(-50%, -50%)";
        notification.style.padding = "10px";
        notification.style.backgroundColor = "#333";
        notification.style.color = "#fff";
        notification.style.fontFamily = "Arial, sans-serif";
        notification.style.fontSize = "20px";
        notification.style.borderRadius = "5px";
        notification.style.zIndex = "100000";
        notification.style.opacity = "0";
        notification.style.transition = "opacity 0.5s";
        document.body.appendChild(notification);

        // Fade in the notification
        setTimeout(() => {
            notification.style.opacity = "1";
        }, 100);

        // Fade out and remove the notification after 3 seconds
        setTimeout(() => {
            notification.style.opacity = "0";
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 500);
        }, time);
    }

    // Triple click event listener
    function handleTripleClick(event) {
        if (event.detail === 3) {
            const inboxSwitcher = document.querySelector(
                'div[aria-label="Inbox switcher"]'
            );
            if (active === 0) {
                if (isMouseOver(inboxSwitcher)) {
                    active = 1;
                    showNotification("Now chat list is always visible.", 3000);
                } else {
                    active = 2;
                    lockPosition = { x: event.clientX, y: event.clientY };
                    setSessionStorageItem(
                        "lockPosition",
                        JSON.stringify(lockPosition)
                    );
                    showNotification(
                        "You have to triple click exactly here to unlock the chat list."
                    );
                }
            } else if (active === 1) {
                if (isMouseOver(inboxSwitcher)) {
                    active = 0;
                    showNotification("Now chat list is shown on hover.", 3000);
                } else {
                    active = 2;
                    lockPosition = { x: event.clientX, y: event.clientY };
                    setSessionStorageItem(
                        "lockPosition",
                        JSON.stringify(lockPosition)
                    );
                    showNotification(
                        "You have to triple click exactly here to unlock the chat list."
                    );
                }
            } else {
                if (
                    isNearLockPosition(
                        event.clientX,
                        event.clientY,
                        lockPosition
                    )
                ) {
                    active = 0;
                    wrongLockedPlaceAttempt = 0;
                    showNotification("Chat list unlocked successfully.");
                } else {
                    wrongLockedPlaceAttempt++;
                    if (wrongLockedPlaceAttempt >= 10) {
                        showNotification(
                            "You can always logout and login again to reset the lock position."
                        );
                    } else {
                        if (wrongLockedPlaceAttempt >= 5) {
                            showNotification(
                                "Please logout and login again to reset the lock position."
                            );
                        }
                    }
                    const clickPosition = {
                        x: event.clientX,
                        y: event.clientY,
                    };
                    const distance = calculateDistance(
                        lockPosition,
                        clickPosition
                    );
                    if (distance <= clickThreshold * 1.2) {
                        showNotification(
                            "You are near the locked position, try again!!!"
                        );
                    }
                }
            }
            setSessionStorageItem("active", active);
        }
    }

    // Initialize the script
    function init() {
        document.addEventListener("mousemove", function (event) {
            eventParent = event;
            updateSidebarVisibility();
        });

        document.addEventListener("click", handleTripleClick);
    }

    init();
})();
