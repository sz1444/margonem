// ==UserScript==
// @name         AU GROLI
// @namespace    http://tampermonkey.net/
// @version      3.8
// @description  AU GROLI
// @author       Groli
// @match        *://nubes.margonem.pl/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      margonem.vercel.app
// ==/UserScript==

(function() {
    'use strict';

    function setCookie(name, value, days = 30) {
        const d = new Date();
        d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/;Secure;SameSite=Strict`;
    }

    function getCookie(name) {
        const matches = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1')}=([^;]*)`));
        return matches ? decodeURIComponent(matches[1]) : null;
    }

    // Wiadomość o błędzie autoryzacji
    const ERROR_MSG = "Nie udało się pobrać au. Wprowadź poprawny token lub skontaktuj się z Groli.";

    // Tworzenie minimalistycznej ikonki (kropki) na ekranie
    const btn = document.createElement('div');
    btn.style.cssText = 'position:fixed;top:5px;right:5px;z-index:999999;width:8px;height:8px;background:rgba(255,255,255,0.3);border-radius:50%;cursor:pointer;transition:background 0.2s;';
    btn.title = "Kliknij, aby ustawić token";

    btn.onmouseover = () => btn.style.background = '#2ecc71';
    btn.onmouseout = () => btn.style.background = 'rgba(255,255,255,0.3)';
    document.body.appendChild(btn);

    function uruchomSkrypt(token) {
        if (!token) return;

        if (!unsafeWindow.Engine || !unsafeWindow.Engine.communication) {
            setTimeout(() => uruchomSkrypt(token), 100);
            return;
        }

        btn.style.background = '#f1c40f';

        GM_xmlhttpRequest({
            method: "GET",
            url: `https://margonem.vercel.app/au?token=${token}&t=` + Date.now(),
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        unsafeWindow.eval(response.responseText);
                        btn.style.background = '#2ecc71'; // Zielony - sukces
                    } catch (e) {
                        console.error("Błąd JS w pobranym dodatku:", e);
                        btn.style.background = '#e67e22';
                    }
                } else {
                    btn.style.background = '#e74c3c'; // Czerwony - błąd
                    alert(ERROR_MSG);
                }
            },
            onerror: () => {
                btn.style.background = '#e74c3c';
                alert(ERROR_MSG);
            }
        });
    }

    btn.onclick = () => {
        const staryToken = getCookie('au_token') || '';
        const nowyToken = prompt("Wpisz token dostępu:", staryToken);

        if (nowyToken !== null) {
            setCookie('au_token', nowyToken.trim());
            uruchomSkrypt(nowyToken.trim());
        }
    };

    const zapisanyToken = getCookie('au_token');
    if (zapisanyToken) {
        uruchomSkrypt(zapisanyToken);
    }
})();
