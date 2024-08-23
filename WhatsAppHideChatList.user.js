// ==UserScript==
// @name        WhatsApp Hide Chat List
// @namespace   imxitiz's-Script
// @version     0.2
// @grant       none
// @license     GNU GPLv3
// @author      imxitiz
// @match       https://web.whatsapp.com/
// @description Hide WhatsApp Web chat list
// @downloadURL https://update.greasyfork.org/scripts/491894/WhatsApp%20Hide%20Chat%20List.user.js
// @updateURL   https://update.greasyfork.org/scripts/491894/WhatsApp%20Hide%20Chat%20List.user.js
// ==/UserScript==

(function () {
    "use strict";

    let hasInitialized = false;
    const hideThreshold = 60;
    let eventParent;

    // Update chat list visibility
    function updateChatListVisibility() {
        const chatList = document.querySelector("div._aigv:nth-child(4)");

        if (chatList) {
            if (!hasInitialized) {
                chatList.style.display = "flex";
                chatList.style.flex = "0 0";
                chatList.style.maxWidth = "80%";
                chatList.style.width = "0%";
                chatList.style.transition = "width .5s ease-out 0s";

                // headerElement.style.paddingLeft = '0px';
                // headerElement.style.transition = 'all .5s ease-out 0s';

                hasInitialized = true;
            }
            const isMouseOverElement = isMouseOver(chatList);

            if (isMouseOverElement || eventParent.clientX <= hideThreshold) {
                // Show
                chatList.style.width = "100%";
                // headerElement.style.paddingLeft = '16px';
            } else {
                // Hide
                chatList.style.width = "0%";
                // headerElement.style.paddingLeft = '0px';
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
                // If there are added nodes, update the element visibility
                if (mutation.addedNodes.length > 0) {
                    updateChatListVisibility();
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
            updateChatListVisibility(event);
        });
        document.addEventListener("mouseleave", updateChatListVisibility);
    }

    init();
})();
