// ==UserScript==
// @name        WhatsApp Hide Chat List
// @namespace   imxitiz's-Script
// @version     3.1.0
// @grant       none
// @license     GNU GPLv3
// @author      imxitiz
// @contributor imxitiz
// @match       https://web.whatsapp.com/
// @description Hide or show the WhatsApp Web chat list based on user interaction. Includes features for resizing and locking Chat list visibility.
// @downloadURL https://update.greasyfork.org/scripts/491894/WhatsApp%20Hide%20Chat%20List.user.js
// @updateURL   https://update.greasyfork.org/scripts/491894/WhatsApp%20Hide%20Chat%20List.user.js
// ==/UserScript==

(() => {
    "use strict";

    // ============================================================
    // DEBUG SYSTEM — Toggle with localStorage.setItem('WHC_DEBUG','true')
    // ============================================================
    const DEBUG = localStorage.getItem("WHC_DEBUG") === "true";
    const log = (...args) => DEBUG && console.log("[WHC]", ...args);
    const warn = (...args) => DEBUG && console.warn("[WHC]", ...args);
    const error = (...args) => console.error("[WHC]", ...args);
    const group = (label) => DEBUG && console.groupCollapsed(`[WHC] ${label}`);
    const groupEnd = () => DEBUG && console.groupEnd();

    log("Script loaded. DEBUG mode:", DEBUG);
    log("Tip: Set localStorage.setItem('WHC_DEBUG','true') and reload for detailed logs.");

    // ============================================================
    // SELECTOR STRATEGY — Multiple fallback strategies for resilience
    // ============================================================
    // WhatsApp changes class names frequently. We use a multi-strategy
    // approach: try stable selectors first, fall back to structural ones.
    //
    // SIDEBAR: The container that holds BOTH the sidebar header AND
    // the chat list (#side). Hiding this container hides everything.
    //   1. div.two > div:has(> #side) — structural, most reliable
    //   2. #side — the chat list itself (fallback, won't hide header)
    //
    // HEADER (inbox switcher): The top bar with WhatsApp logo
    //   1. div.two > header — the direct child header of the main container
    //   2. header — any header (fallback)
    // ============================================================

    const Selectors = {
        sidebar: [
            "div.two > div:has(> #side)",
            "#side",
        ],
        header: [
            "div.two > header",
            "header",
        ],
    };

    /**
     * Try multiple selectors and return the first match.
     * Logs which strategy succeeded for debugging.
     */
    function queryFirst(selectorList, label) {
        for (let i = 0; i < selectorList.length; i++) {
            const sel = selectorList[i];
            try {
                const el = document.querySelector(sel);
                if (el) {
                    if (i > 0) {
                        warn(
                            `Selector fallback #${i} for "${label}": "${sel}"`,
                        );
                    }
                    log(`Found "${label}" with: "${sel}"`);
                    return el;
                }
            } catch (e) {
                warn(`Invalid selector "${sel}" for "${label}":`, e.message);
            }
        }
        error(`No selector matched for "${label}" — tried:`, selectorList);
        return null;
    }

    // ============================================================
    // STATE
    // ============================================================
    let hasInitialized = false;
    const hideThreshold = 20;
    let eventParent;
    let isResizing = false;
    let userDefinedFlexBasis =
        parseFloat(getLocalStorageItem("userDefinedFlexBasis")) || 30;
    let userResizedOnce =
        getSessionStorageItem("userResizedOnce") === "true" || false;
    let active = parseInt(getSessionStorageItem("active"), 10) || 0;
    // active states:
    // 0 - Normal: sidebar shown on hover/edge, hidden otherwise
    // 1 - Always visible
    // 2 - Always hidden (locked — triple right-click to unlock)
    // 3 - Always hidden (unlocked)
    let blurEffect =
        getSessionStorageItem("blurEffect") === "true" || false;
    let lockPosition = JSON.parse(getSessionStorageItem("lockPosition")) || {
        x: 0,
        y: 0,
    };
    const clickThreshold = 80;
    let wrongLockedPlaceAttempt = 0;

    // ============================================================
    // STORAGE HELPERS
    // ============================================================
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

    // ============================================================
    // RESIZE HANDLE
    // ============================================================
    function createResizeHandle() {
        try {
            const sidebar = queryFirst(Selectors.sidebar, "sidebar");
            if (!sidebar) {
                throw new Error("Sidebar element not found");
            }

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

                resizeHandle.addEventListener("mousedown", () => {
                    isResizing = true;
                    document.addEventListener("mousemove", resizeChatList);
                    document.addEventListener("mouseup", stopResize);
                });
                log("Resize handle created");
            }
        } catch (err) {
            error("Error creating resize handle:", err);
            setTimeout(createResizeHandle, 1000);
        }
    }

    // ============================================================
    // VISIBILITY CONTROL
    // ============================================================
    /**
     * Get the pixel width for the sidebar based on userDefinedFlexBasis (percentage).
     * flex-basis percentages don't work reliably in all flex container contexts,
     * so we compute pixel values from the parent's width.
     */
    function getSidebarPixelWidth(sidebar) {
        const parentWidth = sidebar.parentElement
            ? sidebar.parentElement.clientWidth
            : window.innerWidth;
        return Math.round(parentWidth * (userDefinedFlexBasis / 100));
    }

    function changeVisibility(sidebar, show) {
        if (!sidebar) return;
        if (show) {
            const px = getSidebarPixelWidth(sidebar);
            sidebar.style.maxWidth = `${px}px`;
            sidebar.style.minWidth = `${px}px`;
            sidebar.style.flex = `0 0 ${px}px`;
            sidebar.style.padding = "";
            sidebar.style.width = "";
        } else {
            sidebar.style.width = "0";
            sidebar.style.maxWidth = "0";
            sidebar.style.minWidth = "0";
            sidebar.style.flex = "0 0 0";
            sidebar.style.padding = "0";
        }
        log("Visibility changed:", show ? "SHOW" : "HIDE");
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================
    function initialize() {
        const sidebar = queryFirst(Selectors.sidebar, "sidebar");
        group("initialize()");
        if (sidebar) {
            if (!hasInitialized) {
                log("Sidebar found, applying initial state. active:", active);
                if (sidebar.style.maxWidth !== "0px") {
                    changeVisibility(sidebar, active === 1);
                    createBlurEffect(blurEffect);
                    setTimeout(initialize, 1000);
                }
                if (sidebar.style.maxWidth === "0px") {
                    setTimeout(() => {
                        changeVisibility(sidebar, active === 1);
                        createBlurEffect(blurEffect);
                    }, 2000);
                }
            } else {
                log("Already initialized, skipping.");
            }
        } else {
            log("Sidebar not found, retrying in 1s...");
            setTimeout(initialize, 1000);
        }
        groupEnd();
    }

    // ============================================================
    // SIDEBAR VISIBILITY UPDATE (mousemove handler)
    // ============================================================
    function updateSidebarVisibility() {
        const sidebar = queryFirst(Selectors.sidebar, "sidebar");
        const inboxSwitcher = queryFirst(Selectors.header, "header");

        if (sidebar && inboxSwitcher) {
            if (!hasInitialized) {
                log("First-time setup: applying base styles to sidebar");
                const px = getSidebarPixelWidth(sidebar);
                sidebar.style.display = "flex";
                sidebar.style.flex = `0 0 ${px}px`;
                sidebar.style.maxWidth = "100%";
                sidebar.style.width = "0%";
                sidebar.style.transition = "width .5s ease-out";
                sidebar.style.position = "relative";
                sidebar.style.overflow = "hidden";
                hasInitialized = true;
                createResizeHandle();
            }

            const isMouseOverSidebar =
                isMouseOver(sidebar) || isMouseOver(inboxSwitcher);

            group("updateSidebarVisibility()");
            log(
                "active:",
                active,
                "| isMouseOverSidebar:",
                isMouseOverSidebar,
                "| isResizing:",
                isResizing,
                "| mouseX:",
                eventParent.clientX,
            );

            if (active === 1) {
                changeVisibility(sidebar, true);
            } else if (active === 2 || active === 3) {
                changeVisibility(sidebar, false);
            } else {
                // Normal behavior (active === 0)
                if (
                    isMouseOverSidebar ||
                    eventParent.clientX <= hideThreshold ||
                    isResizing
                ) {
                    changeVisibility(sidebar, true);
                } else {
                    changeVisibility(sidebar, false);
                }
            }
            groupEnd();
        } else {
            warn(
                "Missing elements — sidebar:",
                !!sidebar,
                "header:",
                !!inboxSwitcher,
            );
        }
    }

    // ============================================================
    // RESIZE LOGIC
    // ============================================================
    function resizeChatList(e) {
        if (isResizing) {
            const sidebar = queryFirst(Selectors.sidebar, "sidebar");
            if (!sidebar) return;
            const containerWidth = sidebar.parentElement.clientWidth;
            const newFlexBasis =
                ((e.clientX - sidebar.getBoundingClientRect().left) /
                    containerWidth) *
                100;

            if (newFlexBasis >= 10 && newFlexBasis <= 100) {
                userDefinedFlexBasis = newFlexBasis;
                const px = getSidebarPixelWidth(sidebar);
                sidebar.style.maxWidth = `${px}px`;
                sidebar.style.minWidth = `${px}px`;
                sidebar.style.flex = `0 0 ${px}px`;
            }

            if (!userResizedOnce) {
                userResizedOnce = true;
                setSessionStorageItem("userResizedOnce", "true");
                const resizeHandle =
                    document.getElementById("resize-handle");
                if (resizeHandle)
                    resizeHandle.style.backgroundColor = "transparent";
            }
            setLocalStorageItem(
                "userDefinedFlexBasis",
                userDefinedFlexBasis,
            );
        }
    }

    function stopResize() {
        isResizing = false;
        document.removeEventListener("mousemove", resizeChatList);
        document.removeEventListener("mouseup", stopResize);
    }

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================
    function isMouseOver(element) {
        return element && eventParent && element.contains(eventParent.target);
    }

    function calculateDistance(pos1, pos2) {
        return Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2);
    }

    function isNearLockPosition(x, y, lockPos) {
        const distance = calculateDistance(lockPos, { x, y });
        return distance <= clickThreshold;
    }

    // ============================================================
    // NOTIFICATIONS
    // ============================================================
    function showNotification(message, time = 5000) {
        const previousNotification = document.querySelector(
            "div.notification[role='alert']",
        );
        if (previousNotification) {
            document.body.removeChild(previousNotification);
        }

        const notification = document.createElement("div");
        notification.setAttribute("role", "alert");
        notification.classList.add("notification");
        notification.innerHTML = message;
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

        setTimeout(() => {
            notification.style.opacity = "1";
        }, 100);

        setTimeout(() => {
            notification.style.opacity = "0";
            setTimeout(() => {
                if (document.body.contains(notification))
                    document.body.removeChild(notification);
            }, 500);
        }, time);
    }

    // ============================================================
    // STATE MANAGEMENT
    // ============================================================
    function changeActiveState(newActiveState, message = null, time = 3000) {
        active = newActiveState;
        setSessionStorageItem("active", active);
        if (message === null) {
            message = notificationBasedOnActiveState(active);
        }
        if (message) {
            showNotification(message, time);
        }
        log("Active state changed to:", active);
    }

    function changeBlurEffectState(newBlurEffectState) {
        blurEffect = newBlurEffectState;
        setSessionStorageItem("blurEffect", blurEffect);
    }

    // ============================================================
    // TOOLBAR
    // ============================================================
    function createToolBar() {
        const customToolbar = document.createElement("div");
        customToolbar.id = "customToolbar";
        document.body.appendChild(customToolbar);

        const overlay = document.createElement("div");
        overlay.id = "overlay";
        document.body.appendChild(overlay);

        const overlayButton = document.createElement("button");
        overlayButton.id = "overlayButton";
        overlayButton.classList.add("eye");
        if (blurEffect) {
            overlayButton.innerHTML = "🙈";
        } else {
            overlayButton.innerHTML = "🐵";
        }
        overlayButton.addEventListener("click", () => {
            const btn = document.getElementById("overlayButton");
            if (blurEffect) {
                btn.innerHTML = "🐵";
                createBlurEffect(false);
            } else {
                btn.innerHTML = "🙈";
                createBlurEffect(true);
            }
        });
        customToolbar.appendChild(overlayButton);

        const githubLink = document.createElement("a");
        githubLink.id = "githubLink";
        githubLink.href =
            "https://kshitizsharma.com.np/userscriptsupport";
        githubLink.innerHTML = "imxitiz<br><h6>(Support)</h6>";
        customToolbar.appendChild(githubLink);

        log("Toolbar created");
    }

    function changeVisibilityOfToolbar(show = true) {
        const customToolbar = document.getElementById("customToolbar");
        if (customToolbar) {
            customToolbar.style.right = show ? "0" : "-200px";
        }
    }

    function updateToolBarVisibility() {
        if (
            eventParent.clientX >= window.innerWidth - hideThreshold ||
            isMouseOver(document.getElementById("customToolbar"))
        ) {
            changeVisibilityOfToolbar(true);
        } else {
            changeVisibilityOfToolbar(false);
        }
    }

    // ============================================================
    // BLUR EFFECT
    // ============================================================
    function createBlurEffect(show = false) {
        let blurEffectElement = document.getElementById("blur-effect");

        changeBlurEffectState(show);

        if (!blurEffectElement) {
            blurEffectElement = document.createElement("div");
            blurEffectElement.id = "blur-effect";
            blurEffectElement.style.position = "fixed";
            blurEffectElement.style.top = "0";
            blurEffectElement.style.left = "0";
            blurEffectElement.style.width = "100%";
            blurEffectElement.style.height = "100%";
            blurEffectElement.style.backgroundColor = "rgba(0, 0, 0, 0)";
            blurEffectElement.style.zIndex = "100000";
            blurEffectElement.style.backdropFilter = "blur(0px)";
            blurEffectElement.style.transition =
                "background-color 0.5s ease, backdrop-filter 0.5s ease";
            blurEffectElement.style.display = "none";

            function preventDefaultAndStopPropagation(event) {
                event.preventDefault();
                event.stopPropagation();
            }

            blurEffectElement.addEventListener(
                "click",
                preventDefaultAndStopPropagation,
            );
            blurEffectElement.addEventListener(
                "contextmenu",
                preventDefaultAndStopPropagation,
            );
            blurEffectElement.addEventListener(
                "mousedown",
                preventDefaultAndStopPropagation,
            );
            blurEffectElement.addEventListener("mousemove", (event) => {
                if (event.clientX >= window.innerWidth - hideThreshold) {
                    changeVisibilityOfToolbar(true);
                } else {
                    changeVisibilityOfToolbar(false);
                }
                preventDefaultAndStopPropagation(event);
            });
            document.body.appendChild(blurEffectElement);
        }

        if (show) {
            blurEffectElement.style.display = "block";
            setTimeout(() => {
                blurEffectElement.style.backgroundColor =
                    "rgba(0, 0, 0, 0.5)";
                blurEffectElement.style.backdropFilter = "blur(10px)";
            }, 10);
            activateShortcutBlocker();
        } else {
            blurEffectElement.style.backgroundColor = "rgba(0, 0, 0, 0)";
            blurEffectElement.style.backdropFilter = "blur(0px)";
            setTimeout(() => {
                blurEffectElement.style.display = "none";
            }, 500);
            deactivateShortcutBlocker();
        }
    }

    function blockKeyboardShortcuts(event) {
        event.preventDefault();
        event.stopPropagation();
    }

    function activateShortcutBlocker() {
        document.addEventListener("keydown", blockKeyboardShortcuts, true);
    }

    function deactivateShortcutBlocker() {
        document.removeEventListener("keydown", blockKeyboardShortcuts, true);
    }

    // ============================================================
    // KEYBOARD SHORTCUTS
    // ============================================================
    function handleKeyDown(event) {
        // Alt+S: Toggle sidebar visibility (cycle through states 0 → 3 → 0)
        if (event.altKey && (event.key === "s" || event.key === "S")) {
            event.preventDefault();
            event.stopPropagation();
            log("Alt+S pressed, current active:", active);
            if (active === 0) {
                changeActiveState(3); // Hide (unlocked)
            } else if (active === 3) {
                changeActiveState(0); // Back to normal hover mode
            } else if (active === 1) {
                changeActiveState(0); // Back to normal hover mode
            } else if (active === 2) {
                // Locked — don't toggle via keyboard, user must triple-click
                showNotification(
                    "Chat list is locked! Triple right-click at the lock position to unlock.",
                );
            }
            // Immediately reflect
            const sidebar = queryFirst(Selectors.sidebar, "sidebar");
            if (sidebar) {
                changeVisibility(sidebar, active === 1);
            }
            setSessionStorageItem("active", active);
        }
    }

    // ============================================================
    // NOTIFICATION TEXT
    // ============================================================
    function notificationBasedOnActiveState(activeState) {
        const messages = {
            0: "Now chat list is shown on hover.",
            1: "Now chat list is always visible.",
            2: "Now chat list is always hidden, but locked.",
            3: "Now chat list is always hidden, but not locked.",
        };
        return messages[activeState] || null;
    }

    // ============================================================
    // TRIPLE CLICK HANDLER
    // ============================================================
    function handleClick(event, clickcount = 0) {
        if (event.detail === 3 || clickcount === 3) {
            const inboxSwitcher = queryFirst(
                Selectors.header,
                "header",
            );
            group("handleClick()");
            log(
                "active:",
                active,
                "| button:",
                event.button,
                "| isMouseOverHeader:",
                inboxSwitcher ? isMouseOver(inboxSwitcher) : false,
            );

            if (active === 0) {
                if (inboxSwitcher && isMouseOver(inboxSwitcher)) {
                    changeActiveState(1);
                } else {
                    if (event.button === 2) {
                        active = 2;
                        lockPosition = {
                            x: event.clientX,
                            y: event.clientY,
                        };
                        setSessionStorageItem(
                            "lockPosition",
                            JSON.stringify(lockPosition),
                        );
                        showNotification(
                            "You have to triple click exactly here to unlock the chat list.",
                        );
                    } else {
                        changeActiveState(3);
                    }
                }
            } else if (active === 1) {
                if (inboxSwitcher && isMouseOver(inboxSwitcher)) {
                    changeActiveState(0);
                } else {
                    if (event.button === 2) {
                        active = 2;
                        lockPosition = {
                            x: event.clientX,
                            y: event.clientY,
                        };
                        setSessionStorageItem(
                            "lockPosition",
                            JSON.stringify(lockPosition),
                        );
                        showNotification(
                            "You have to triple click exactly here to unlock the chat list.",
                        );
                    } else {
                        changeActiveState(3);
                    }
                }
            } else if (active === 2) {
                if (wrongLockedPlaceAttempt > 16) {
                    groupEnd();
                    return;
                }
                if (
                    isNearLockPosition(
                        event.clientX,
                        event.clientY,
                        lockPosition,
                    )
                ) {
                    if (event.button === 2) {
                        wrongLockedPlaceAttempt = 0;
                        changeActiveState(0);
                    }
                } else {
                    if (wrongLockedPlaceAttempt <= 16) {
                        wrongLockedPlaceAttempt++;
                    }
                    if (wrongLockedPlaceAttempt >= 15) {
                        showNotification(
                            "You're banned! Please refresh the page to start again. <br>OR<br> You can always logout and login again to reset the lock position.",
                        );
                    } else if (wrongLockedPlaceAttempt >= 10) {
                        showNotification(
                            "You can always logout and login again to reset the lock position.",
                        );
                    } else {
                        if (wrongLockedPlaceAttempt >= 5) {
                            showNotification(
                                "Please logout and login again to reset the lock position.",
                            );
                        }
                    }
                    const clickPosition = {
                        x: event.clientX,
                        y: event.clientY,
                    };
                    const distance = calculateDistance(
                        lockPosition,
                        clickPosition,
                    );
                    if (distance <= clickThreshold * 1.2) {
                        showNotification(
                            "You are near the locked position, try again!!!",
                        );
                    }
                }
            } else if (active === 3) {
                if (inboxSwitcher && isMouseOver(inboxSwitcher)) {
                    changeActiveState(1);
                } else {
                    if (event.button === 2) {
                        active = 2;
                        lockPosition = {
                            x: event.clientX,
                            y: event.clientY,
                        };
                        setSessionStorageItem(
                            "lockPosition",
                            JSON.stringify(lockPosition),
                        );
                        showNotification(
                            "You have to triple click exactly here to unlock the chat list.",
                        );
                    } else {
                        changeActiveState(0);
                    }
                }
            }

            // Immediately reflect the change
            const sidebar = queryFirst(Selectors.sidebar, "sidebar");
            if (sidebar) {
                changeVisibility(sidebar, active === 1);
            }
            setSessionStorageItem("active", active);
            groupEnd();
        }
    }

    // ============================================================
    // DOM OBSERVER — Re-initialize if WhatsApp re-renders the layout
    // ============================================================
    function setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            if (hasInitialized) return;

            for (const mutation of mutations) {
                if (mutation.type === "childList") {
                    const sidebar = queryFirst(
                        Selectors.sidebar,
                        "sidebar",
                    );
                    if (sidebar && !hasInitialized) {
                        log(
                            "MutationObserver: sidebar detected, initializing...",
                        );
                        initialize();
                        break;
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
        log("MutationObserver started");
    }

    // ============================================================
    // MAIN INIT
    // ============================================================
    function init() {
        log("=== INIT START ===");
        log("DOM state:", {
            side: !!document.querySelector("#side"),
            two: !!document.querySelector("div.two"),
            header: !!document.querySelector("header"),
            paneSide: !!document.querySelector("#pane-side"),
            sidebarContainer: !!document.querySelector(
                "div.two > div:has(> #side)",
            ),
        });

        createToolBar();
        initialize();
        setupMutationObserver();

        document.addEventListener("mousemove", (event) => {
            eventParent = event;
            updateSidebarVisibility();
            updateToolBarVisibility();
        });

        document.addEventListener("click", handleClick);

        // Alt+S keyboard shortcut
        document.addEventListener("keydown", handleKeyDown);

        let lastRightClickTime = 0;
        let rightClickCount = 0;

        document.addEventListener("mousedown", (event) => {
            if (event.button !== 2) {
                return;
            }
            const avoidElements = [
                "IMG",
                "VIDEO",
                "AUDIO",
                "SOURCE",
                "A",
                "BUTTON",
                "INPUT",
                "SELECT",
                "TEXTAREA",
                "IFRAME",
                "EMBED",
                "OBJECT",
                "CANVAS",
                "SVG",
            ];
            if (
                avoidElements.includes(event.target.tagName) ||
                event.target.isContentEditable ||
                event.target.getAttribute("role") === "textbox" ||
                window.getSelection().toString().trim().length > 0
            ) {
                return;
            }
            event.preventDefault();

            const currentTime = Date.now();
            if (currentTime - lastRightClickTime < 500) {
                rightClickCount++;
            } else {
                rightClickCount = 1;
            }
            lastRightClickTime = currentTime;

            handleClick(event, rightClickCount);
        });

        log("=== INIT COMPLETE ===");
    }

    // ============================================================
    // STYLES
    // ============================================================
    const styles = `
        #customToolbar {
            position: fixed;
            top: 48%;
            right: -200px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: linear-gradient(
                45deg,
                rgba(255, 69, 0, 0.8),
                rgba(255, 140, 0, 0.8),
                rgba(255, 215, 0, 0.8)
            );
            z-index: 1000000;
            padding: 5px;
            border-radius: 10px;
            transition: right 0.5s ease;
        }

        #overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: none;
            z-index: 99999;
        }

        #overlayButton {
            background-color: #333;
            color: #fff;
            border: none;
            padding: 8px;
            margin: 5px 10px;
            cursor: pointer;
            border-radius: 10px;
            font-size: 2.5rem;
        }

        #overlayButton:hover {
            background-color: #555;
            filter: drop-shadow(0 0 5px #fff);
        }

        #githubLink {
            color: #285ed0;
            text-decoration: none;
            font-size: 1.5rem;
            font-weight: bold;
            margin: 5px 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
        }

        #githubLink h6 {
            margin: 0;
            font-size: 1rem;
            font-weight: normal;
        }

        #githubLink:hover {
            text-decoration: underline;
        }
    `;

    const styleElement = document.createElement("style");
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);

    // ============================================================
    // BOOT
    // ============================================================
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
