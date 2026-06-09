// ==UserScript==
// @name        Photopea No Ads Sidebar
// @namespace   imxitiz's-Scripts
// @version     0.2
// @grant       none
// @license     GNU GPLv3
// @author      imxitiz
// @match       https://www.photopea.com/*
// @description Remove the gap of ads Sidebar
// @run-at      document-start
// @downloadURL https://update.greasyfork.org/scripts/503627/Photopea%20No%20Ads%20Sidebar.user.js
// @updateURL   https://update.greasyfork.org/scripts/503627/Photopea%20No%20Ads%20Sidebar.meta.js
// ==/UserScript==

(function() {
  let W, busy = false;

  function fix() {
    if (busy) return;
    busy = true;
    try {
      const app = document.querySelector('.app');
      if (!app) { busy = false; return; }
      if (!W) W = app.offsetWidth + 'px';

      // Remove ad sidebar (2nd child of .app) and expand everything to full width
      const ad = app.children[1];
      if (ad) ad.remove();

      app.children[0].style.width = W;
      app.children[0].style.minWidth = W;

      document.querySelectorAll('.flexrow,.panelblock,.panelblock > div,.panelblock .body,.panelhead')
        .forEach(el => {
          el.style.width = W;
          el.style.minWidth = W;
          el.style.maxWidth = W;
        });

      // Expand all direct children of main content (toolbar, editor, etc.)
      const main = app.children[0];
      if (main) Array.from(main.children).forEach(el => {
        el.style.width = W;
        el.style.minWidth = W;
        el.style.maxWidth = W;
      });
    } catch(e) {}
    busy = false;
  }

  const obs = new MutationObserver(fix);
  function start() {
    if (!document.body) { requestAnimationFrame(start); return; }
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    fix();
  }
  start();
})();
