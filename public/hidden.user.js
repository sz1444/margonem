// ==UserScript==
// @name         Ukryte dodatki Groli
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Ukryte dodatki (logowanie przez Discord)
// @updateURL    https://margonem.vercel.app/hidden.user.js
// @downloadURL  https://margonem.vercel.app/hidden.user.js
// @author       Groli
// @match        *://nubes.margonem.pl/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        unsafeWindow
// @connect      margonem.vercel.app
// ==/UserScript==

(function() {
    'use strict';

    const REMOTE_URL = "https://margonem.vercel.app/hidden.js";

    GM_xmlhttpRequest({
        method: "GET",
        url: REMOTE_URL + "?t=" + Date.now(),
        onload: function(res) {
            try {
                eval(res.responseText);
            } catch (e) {
                console.error("❌ Błąd ładowania ukrytych dodatków:", e);
            }
        }
    });
})();
