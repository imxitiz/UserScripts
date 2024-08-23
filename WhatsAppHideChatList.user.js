// ==UserScript==
// @name        WhatsApp Hide Chat List
// @namespace   imxitiz's-Script
// @version     1.0
// @grant       none
// @license     GNU GPLv3
// @author      imxitiz
// @match       https://web.whatsapp.com/
// @description Hide WhatsApp Web chat list
// @downloadURL https://update.greasyfork.org/scripts/491894/WhatsApp%20Hide%20Chat%20List.user.js
// @updateURL   https://update.greasyfork.org/scripts/491894/WhatsApp%20Hide%20Chat%20List.user.js
// ==/UserScript==

(function () {
    ("use strict");
    let hasInitialized = false;
    const hideThreshold = 60;
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

    // Update chat list visibility
    function updateChatListVisibility() {
        const chatList = document.querySelector("div._aigv:nth-child(4)");

        if (chatList) {
            if (!hasInitialized) {
                chatList.style.display = "flex";
                chatList.style.flex = `0 0 ${userDefinedFlexBasis}%`;
                chatList.style.maxWidth = "100%";
                chatList.style.width = "0%";
                chatList.style.transition = "width .5s ease-out";
                chatList.style.position = "relative";
                chatList.style.overflow = "hidden";
                hasInitialized = true;

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
                chatList.appendChild(resizeHandle);

                // Start resizing when the user clicks on the resize handle
                resizeHandle.addEventListener("mousedown", function () {
                    isResizing = true;
                    document.addEventListener("mousemove", resizeChatList);
                    document.addEventListener("mouseup", stopResize);
                });
            }

            const isMouseOverElement = isMouseOver(chatList);

            if (
                isMouseOverElement ||
                eventParent.clientX <= hideThreshold ||
                isResizing
            ) {
                chatList.style.width = "100%";
                chatList.style.flex = `0 0 ${userDefinedFlexBasis}%`;
            } else {
                chatList.style.width = "0%";
                chatList.style.flex = "0 0 0";
            }
        }
    }

    // Resize the chat list while the mouse is moving
    function resizeChatList(e) {
        if (isResizing) {
            const chatList = document.querySelector("div._aigv:nth-child(4)");
            const containerWidth = chatList.parentElement.clientWidth;
            let newFlexBasis =
                ((e.clientX - chatList.getBoundingClientRect().left) /
                    containerWidth) *
                100;

            if (newFlexBasis >= 10 && newFlexBasis <= 100) {
                userDefinedFlexBasis = newFlexBasis;
                chatList.style.flex = `0 0 ${userDefinedFlexBasis}%`;
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
            if (
                mutation.type === "childList" &&
                mutation.addedNodes.length > 0
            ) {
                updateChatListVisibility();
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Initialize the script
    function init() {
        document.addEventListener("mousemove", function (event) {
            eventParent = event;
            updateChatListVisibility(event);
        });
        document.addEventListener("mouseleave", updateChatListVisibility);
    }

    init();
})();
