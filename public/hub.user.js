// ==UserScript==
// @name         Panel dodatków Groli
// @namespace    http://tampermonkey.net/
// @version      3.6
// @description  Panel dodatków
// @updateURL    https://margonem.vercel.app/hub.user.js
// @downloadURL  https://margonem.vercel.app/hub.user.js
// @author       Groli
// @match        *://nubes.margonem.pl/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      margonem.vercel.app
// @connect      firebasedatabase.app
// ==/UserScript==

(function() {
    'use strict';

    const REMOTE_URL = "https://margonem.vercel.app/hub.js";

    GM_xmlhttpRequest({
        method: "GET",
        url: REMOTE_URL + "?t=" + Date.now(),
        onload: function(res) {
            try {
                eval(res.responseText);
                console.log("%c[Groli Loader] Panel załadowany z serwera.", "color: #2ecc71; font-weight: bold;");
            } catch (e) {
                console.error("❌ Błąd ładowania rdzenia panelu:", e);
            }
        }
    });
})();
