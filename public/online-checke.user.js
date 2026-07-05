// ==UserScript==
// @name         Online Checker - By Groli
// @version      3.9
// @match        https://www.margonem.pl/
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    if (window.self !== window.top) return;

    const ENDPOINTS = [
        'https://public-api.margonem.pl/info/online/nubes.json',
        'https://public-api.margonem.pl/info/online/luvia.json'
    ];

    let watchedId = localStorage.getItem('watched_single_id') || '';
    const savedPos = JSON.parse(localStorage.getItem('checkerPos')) || { top: "85%", left: "20px" };
    let refreshInterval = null;

    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        #miniChecker { position: fixed; z-index: 9999999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; user-select: none; background: rgba(10, 10, 10, 0.9); backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px 10px; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); cursor: move; }
        .mc-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #555; display: inline-block; flex-shrink: 0; }
        .mc-status-dot.online { background: #2ecc71; box-shadow: 0 0 6px #2ecc71; }
        .mc-status-dot.offline { background: #e74c3c; box-shadow: 0 0 6px #e74c3c; }
        .mc-status-dot.error { background: #f1c40f; box-shadow: 0 0 6px #f1c40f; }
        .mc-text { color: #eee; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; }
        .mc-btn { background: none; border: none; padding: 2px; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0.6; transition: opacity 0.2s; }
        .mc-btn:hover { opacity: 1; }
        .mc-btn svg { stroke: #fff; fill: none; }
        .mc-del svg { stroke: #e74c3c; }
        #mcInput { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px; padding: 2px 6px; font-size: 10px; width: 60px; outline: none; }
        #mcInput:focus { border-color: rgba(255,255,255,0.3); }
    `;
    document.head.appendChild(styleSheet);

    const hub = document.createElement('div');
    hub.id = "miniChecker";
    hub.style.top = savedPos.top;
    hub.style.left = savedPos.left;
    document.body.appendChild(hub);

    function startAutoRefresh() {
        stopAutoRefresh();
        refreshInterval = setInterval(checkOnline, 10000);
    }

    function stopAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
    }

    function render() {
        if (!watchedId) {
            stopAutoRefresh();
            hub.innerHTML = `
                <input type="text" id="mcInput" placeholder="ID konta">
                <button id="mcAdd" class="mc-btn">
                    <svg width="12" height="12" viewBox="0 0 24 24" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
            `;

            const input = document.getElementById('mcInput');
            const addBtn = document.getElementById('mcAdd');

            const saveId = () => {
                const id = input.value.replace(/\D/g, '');
                if (id) {
                    watchedId = id;
                    localStorage.setItem('watched_single_id', id);
                    render();
                } else {
                    input.value = '';
                }
            };

            addBtn.onclick = saveId;
            input.onkeydown = (e) => { if (e.key === 'Enter') saveId(); };
        } else {
            hub.innerHTML = `
                <span id="mcDot" class="mc-status-dot"></span>
                <span class="mc-text"></span>
                <button id="mcDel" class="mc-btn mc-del">
                    <svg width="11" height="11" viewBox="0 0 24 24" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            `;

            hub.querySelector('.mc-text').textContent = watchedId;

            document.getElementById('mcDel').onclick = () => {
                watchedId = '';
                localStorage.removeItem('watched_single_id');
                render();
            };

            checkOnline();
            startAutoRefresh();
        }
    }

    async function checkOnline() {
        if (!watchedId) return;
        const dot = document.getElementById('mcDot');
        const timestamp = new Date().getTime();

        try {
            const requests = ENDPOINTS.map(url => fetch(`${url}`).then(res => res.ok ? res.json() : []));
            const results = await Promise.all(requests);

            const onlineIds = results.flat().map(p => String(p.a));

            if (dot) {
                dot.className = 'mc-status-dot ' + (onlineIds.includes(String(watchedId)) ? 'online' : 'offline');
            }
        } catch (e) {
            if (dot) dot.className = 'mc-status-dot error';
        }
    }

    let isDragging = false;
    let offset = { x: 0, y: 0 };

    hub.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
        isDragging = true;
        offset = { x: e.clientX - hub.offsetLeft, y: e.clientY - hub.offsetTop };
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let newLeft = e.clientX - offset.x;
        let newTop = e.clientY - offset.y;

        hub.style.left = Math.max(0, Math.min(newLeft, window.innerWidth - hub.offsetWidth)) + "px";
        hub.style.top = Math.max(0, Math.min(newTop, window.innerHeight - hub.offsetHeight)) + "px";
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            localStorage.setItem('checkerPos', JSON.stringify({ top: hub.style.top, left: hub.style.left }));
        }
    });

    render();
})();
