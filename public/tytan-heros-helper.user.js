// ==UserScript==
// @name         Tytan Helper BETA
// @namespace    http://tampermonkey.net/
// @version      8.5
// @description  Tytan Helper BETA
// @author       Groli
// @match        *://nubes.margonem.pl/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- KONFIGURACJA ---
    const MAP_CONFIG = [
        {
            name: "Sala Tronowa",
            monster: "Tanroth",
            icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/ice_king.gif",
            fallbackId: "p2758"
        },
        {
            name: "Sala Zrujnowanej Świątyni",
            monster: "Barbatos",
            icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/hebrehoth_smokoludzie.gif",
            fallbackId: "p238"
        },
        {
            name: "Teotihuacan",
            monster: "Tezcatlipoca",
            icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/tezcatlipoca.gif",
            fallbackId: "n166"
        },
        {
            name: "Nora Jaszczurzych Koszmarów - źródło",
            monster: "Maddok Magua",
            icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/maddok_magua-1a.gif",
            fallbackId: "s85"
        },
        {
            name: "Komnata Krwawych Obrzędów",
            monster: "Demon Sekty",
            icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/przyz_demon_sekta.gif",
            fallbackId: "p157"
        },
        {
            name: "Źródło Wspomnień",
            monster: "Łowczyni Wspomnień",
            icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/lowcz-wspo-driady.gif",
            fallbackId: "p211"
        },
        {
            name: "Lokum Złych Goblinów - pracownia",
            monster: "Versus Zoons",
            icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/versus-zoons.gif",
            fallbackId: "p182"
        },
        {
            name: "Wulkan Politraki - Piekielne Czeluście",
            monster: "Archdemon",
            icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/archdemon.gif",
            fallbackId: "p251"
        },
        {
            name: "Bandyckie Chowisko - skarbiec",
            monster: "Renegat Baulus",
            icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/renegat_baulus.gif",
            fallbackId: "p172"
        },
    ];

    const QUICK_ALERTS = [
        { label: "STOP", msg: '<b style="color:#e74c3c">STOP!</b>' },
        { label: "ŁAPAĆ", msg: '<b style="color:#e74c3c">Łapać ich!</b>' },
        { label: "DOBIJAĆ", msg: '<b style="color:#e74c3c">Dobijać!</b>' },
        { label: "WCHODZIMY", msg: '<b style="color:#e74c3c">Wchodzimy!</b>' }
    ];

    const BACKEND_URL = "https://margone-api.onrender.com";
    const CLIENT_ID = "1488794373775687782";

    let socket = null;
    let cachedData = {};
    let currentMyId = null;
    let discordToken = localStorage.getItem('mapSync_dcToken');
    let mapMapping = {};
    let isInitialized = false;

    const savedPos = JSON.parse(localStorage.getItem('mapSyncLite_pos')) || { top: "5px", left: "auto", right: "5px" };
    let isCollapsed = localStorage.getItem('mapSyncLite_collapsed') === 'true';

    function checkUrlForToken() {
        const hash = window.location.hash;
        if (hash.includes("access_token=")) {
            const params = new URLSearchParams(hash.substring(1));
            const token = params.get("access_token");
            if (token) {
                localStorage.setItem('mapSync_dcToken', token);
                window.history.replaceState({}, document.title, window.location.pathname);
                return token;
            }
        }
        return null;
    }

    const tokenFromUrl = checkUrlForToken();
    if (tokenFromUrl) discordToken = tokenFromUrl;

    const style = document.createElement('style');
    style.innerText = `
        #msLiteContainer {
            position: fixed;
            z-index: 10001; user-select: none; cursor: move;
            display: flex;
            flex-direction: column;
            background: rgba(10, 10, 10, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 10px;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.6);
            width: fit-content;
            font-family: 'Verdana', sans-serif;
            transition: height 0.2s ease-in-out;
            overflow: hidden;
        }
        #msLiteHeader {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 8px;
            cursor: move;
            background: rgba(255, 255, 255, 0.03);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        #msLiteTitle {
            font-size: 10px;
            font-weight: bold;
            color: #fff;
            text-shadow: 0 0 5px #5865f2;
            letter-spacing: 0.5px;
        }
        #msLiteToggle {
            cursor: pointer;
            font-size: 18px;
            color: rgba(255,255,255,0.4);
            font-weight: bold;
            line-height: 1;
            margin-left: 10px;
            transition: color 0.2s;
        }
        #msLiteToggle:hover { color: #fff; }

        #msLiteContent {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 4px;
            padding: 6px;
        }
        .ms-lite-item {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 46px;
            padding: 4px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.03);
            border-radius: 6px;
            transition: background 0.2s;
            cursor: help;
        }
        .ms-lite-item:hover {
            background: rgba(255, 255, 255, 0.1);
        }
        .ms-lite-img {
            width: 32px;
            height: 32px;
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            filter: drop-shadow(1px 1px 1px #000);
        }
        .ms-lite-timer {
            font-size: 10px;
            font-weight: bold;
            font-family: monospace;
            color: #666;
            text-shadow: 1px 1px 1px #000;
            margin-top: 2px;
            z-index: 3;
            pointer-events: none;
        }

        #msLiteCtxMenu {
            position: fixed;
            display: none;
            z-index: 20002;
            background: rgba(20, 20, 20, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            padding: 4px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            backdrop-filter: blur(5px);
            min-width: 110px;
            font-family: 'Verdana', sans-serif;
        }
        .ms-ctx-item {
            padding: 6px 12px;
            font-size: 11px;
            font-weight: bold;
            color: #eee;
            cursor: pointer;
            border-radius: 2px;
            transition: background 0.2s;
        }
        .ms-ctx-item:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #5865f2;
        }
        .ms-ctx-header {
            font-size: 9px;
            color: #888;
            padding: 4px 12px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            margin-bottom: 4px;
            text-align: center;
            text-transform: uppercase;
        }

        .ms-lite-alert-box {
            position: fixed; top: 15%; left: 50%; transform: translateX(-50%);
            background: rgba(20, 20, 20, 0.9);
            color: white;
            padding: 12px 25px;
            z-index: 30000;
            border-radius: 4px;
            font-family: 'Verdana', sans-serif;
            text-align: center;
            border-left: 4px solid #e74c3c;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            backdrop-filter: blur(5px);
            pointer-events: none;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
    `;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.id = "msLiteContainer";
    container.style.top = savedPos.top;
    container.style.left = savedPos.left;
    container.style.right = savedPos.right;

    container.innerHTML = `
        <div id="msLiteHeader">
            <div id="msLiteTitle">Tytan Helper</div>
            <div id="msLiteToggle">${isCollapsed ? '+' : '−'}</div>
        </div>
        <div id="msLiteContent" style="display: ${isCollapsed ? 'none' : 'grid'};"></div>
    `;
    document.body.appendChild(container);

    const ctxMenu = document.createElement('div');
    ctxMenu.id = "msLiteCtxMenu";
    document.body.appendChild(ctxMenu);

    function getHeroName() {
        const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        if (win.Engine && win.Engine.hero && win.Engine.hero.d) return win.Engine.hero.d.nick;
        if (win.hero && win.hero.nick) return win.hero.nick;
        return "???";
    }

    function getMapName() {
        const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        const name = win.Engine?.map?.d?.name || win.map?.name || "???";
        return name.trim();
    }

    function sendAlert(monster, message) {
        if (socket && socket.readyState === 1) {
            const data = {
                text: `<b style="color:white">[${monster}]</b> ${message}`,
                sender: getHeroName(),
                ts: Date.now()
            };
            socket.send(JSON.stringify({ type: 'send_alert', data }));
        }
        ctxMenu.style.display = "none";
    }

    function showGlobalAlert(data) {
        if (!data || !data.text) return;
        const alert = document.createElement('div');
        alert.className = "ms-lite-alert-box";
        alert.innerHTML = `
            <div style="font-size: 10px; opacity: 0.6; margin-bottom: 2px;">${data.sender}</div>
            <div style="font-size: 13px; letter-spacing: 0.5px;">${data.text}</div>
        `;
        document.body.appendChild(alert);
        setTimeout(() => {
            alert.style.transition = "opacity 0.8s";
            alert.style.opacity = "0";
            setTimeout(() => alert.remove(), 800);
        }, 5000);
    }

    async function init() {
        render();
        setupDragging();
        setupToggle();

        try {
            const response = await fetch('https://margonem.vercel.app/data.json');
            const config = await response.json();

            mapMapping = {};
            const targetNames = MAP_CONFIG.map(m => m.name.toLowerCase().trim());

            config.columns.forEach(col => {
                col.maps.forEach((m, index) => {
                    const cleanName = m[0].toLowerCase().trim();
                    if (targetNames.includes(cleanName)) {
                        mapMapping[cleanName] = { id: `${col.id}${index}` };
                    }
                });
            });

            // Inteligentne fallbacki dla wszystkich map z konfiguracji
            MAP_CONFIG.forEach(map => {
                const mapKey = map.name.toLowerCase().trim();
                if (!mapMapping[mapKey] && map.fallbackId) {
                    mapMapping[mapKey] = { id: map.fallbackId };
                }
            });

            isInitialized = true;
            render();

            if (discordToken) connectWS(); else showLoginButton();
        } catch (e) {
            // W razie błędu sieci, użyj wszystkich fallbacków z MAP_CONFIG
            MAP_CONFIG.forEach(map => {
                mapMapping[map.name.toLowerCase().trim()] = { id: map.fallbackId };
            });
            isInitialized = true; render();
            if (discordToken) connectWS(); else showLoginButton();
        }
    }

    function setupToggle() {
        const toggle = document.getElementById('msLiteToggle');
        const content = document.getElementById('msLiteContent');
        toggle.onclick = (e) => {
            e.stopPropagation();
            isCollapsed = !isCollapsed;
            content.style.display = isCollapsed ? 'none' : 'grid';
            toggle.innerText = isCollapsed ? '+' : '−';
            localStorage.setItem('mapSyncLite_collapsed', isCollapsed);
        };
    }

    function showLoginButton() {
        const existing = document.getElementById('msLiteLogin');
        if (existing || isCollapsed) return;
        const btn = document.createElement('div');
        btn.id = "msLiteLogin";
        btn.style = "grid-column: 1 / span 3; font-size:11px; background: #5865f2; padding: 6px; border-radius: 4px; cursor: pointer; text-align:center; color: white; font-weight: 600; margin-top: 4px; transition: background 0.2s;";
        btn.innerText = "Połącz konto";
        btn.onmouseover = () => btn.style.background = '#4752c4';
        btn.onmouseout = () => btn.style.background = '#5865f2';
        btn.onclick = () => {
            const REDIRECT_URI = encodeURIComponent(window.location.origin + window.location.pathname);
            window.location.href = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=token&scope=identify%20guilds.members.read`;
        };
        document.getElementById('msLiteContent').appendChild(btn);
    }

    function connectWS() {
        if (!discordToken) return;
        const wsUrl = BACKEND_URL.replace("http", "ws") + `?token=${discordToken}`;
        socket = new WebSocket(wsUrl);

        socket.onmessage = (e) => {
            const msg = JSON.parse(e.data);
            if (msg.type === 'init_data') { cachedData = msg.data || {}; updateUI(); }
            else if (msg.type === 'cell_updated') { cachedData[msg.id] = { val: msg.val, ts: msg.ts }; updateUI(); }
            else if (msg.type === 'global_alert') { showGlobalAlert(msg.data); }
            else if (msg.type === 'auth_error') {
                localStorage.removeItem('mapSync_dcToken');
                showLoginButton();
            }
        };

        socket.onclose = () => setTimeout(connectWS, 5000);
        setInterval(autoCheck, 1000);
    }

    function autoCheck() {
        if (!isInitialized || !socket || socket.readyState !== 1) return;

        const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        const stasisNew = win.Engine?.hero?.checkStasis ? win.Engine.hero.checkStasis() : 0;
        const stasisOld = win.hero?.stasis || 0;

        if (stasisNew !== 0 || stasisOld > 0) {
            currentMyId = null;
            return;
        }

        const currentMap = getMapName().toLowerCase();
        const myNick = getHeroName();
        const mapData = mapMapping[currentMap];

        if (mapData) {
            const id1 = `${mapData.id}_1`, id2 = `${mapData.id}_2`;
            const d1 = cachedData[id1] || { val: "" };
            const d2 = cachedData[id2] || { val: "" };

            if (d1.val === myNick) currentMyId = id1;
            else if (d2.val === myNick) currentMyId = id2;
            else if (!d1.val || d1.val === "") { currentMyId = id1; sync(id1, myNick); }
            else { currentMyId = id2; sync(id2, myNick); }

            if (currentMyId) {
                cachedData[currentMyId] = { val: myNick, ts: Date.now() };
                socket.send(JSON.stringify({ type: 'heartbeat', nick: myNick, id: currentMyId }));
                updateUI();
            }
        } else {
            currentMyId = null;
        }
    }

    function sync(id, val) {
        if (socket?.readyState === 1) {
            socket.send(JSON.stringify({ type: 'update_cell', id, val, ts: val ? Date.now() : 0 }));
        }
    }

    function render() {
        const contentDiv = document.getElementById('msLiteContent');
        if (!contentDiv) return;

        contentDiv.innerHTML = MAP_CONFIG.map(map => {
            const mapKey = map.name.toLowerCase().trim();
            const data = mapMapping[mapKey] || { id: `waiting_${mapKey.replace(/\s/g, '_')}` };
            return `
                <div class="ms-lite-item" data-monster="${map.monster}" title="${map.name}">
                    <div class="ms-lite-img" style="background-image: url('${map.icon}');"></div>
                    <span class="ms-lite-timer" id="lt_${data.id}">--:--</span>
                </div>
            `;
        }).join('');

        contentDiv.querySelectorAll('.ms-lite-item').forEach(item => {
            item.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const monster = item.getAttribute('data-monster');
                showContextMenu(e.clientX, e.clientY, monster);
            };
        });

        if (!discordToken) showLoginButton();
    }

    function showContextMenu(x, y, monster) {
        ctxMenu.innerHTML = `<div class="ms-ctx-header">${monster}</div>`;
        QUICK_ALERTS.forEach(alert => {
            const div = document.createElement('div');
            div.className = "ms-ctx-item";
            div.innerText = alert.label;
            div.onclick = () => sendAlert(monster, alert.msg);
            ctxMenu.appendChild(div);
        });

        ctxMenu.style.left = x + "px";
        ctxMenu.style.top = y + "px";
        ctxMenu.style.display = "block";

        const closeMenu = () => { ctxMenu.style.display = "none"; document.removeEventListener('click', closeMenu); };
        setTimeout(() => document.addEventListener('click', closeMenu), 10);
    }

    function updateUI() {
        const now = Date.now();
        MAP_CONFIG.forEach(map => {
            const data = mapMapping[map.name.toLowerCase().trim()];
            if (!data) return;

            const d1 = cachedData[`${data.id}_1`] || { val: "", ts: 0 };
            const d2 = cachedData[`${data.id}_2`] || { val: "" , ts: 0 };
            const lastTs = Math.max(d1.ts, d2.ts);

            const timerEl = document.getElementById(`lt_${data.id}`);

            if (timerEl && lastTs > 0) {
                const diff = Math.max(0, (now - lastTs) / 1000);
                const min = Math.floor(diff / 60);
                const sec = Math.floor(diff % 60).toString().padStart(2, '0');
                timerEl.innerText = `${min}:${sec}`;

                if (diff < 300) timerEl.style.color = "#2ecc71";
                else if (diff < 600) timerEl.style.color = "#f1c40f";
                else timerEl.style.color = "#e74c3c";
            } else if (timerEl) {
                timerEl.innerText = "--:--";
                timerEl.style.color = "#666";
            }
        });
    }

    function setupDragging() {
        let isDragging = false, offset = { x: 0, y: 0 };
        container.onmousedown = (e) => {
            if (e.target.id === 'msLiteLogin' || e.target.id === 'msLiteToggle') return;
            isDragging = true;
            offset.x = e.clientX - container.offsetLeft;
            offset.y = e.clientY - container.offsetTop;
            ctxMenu.style.display = "none";
        };
        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let newX = Math.max(0, Math.min(e.clientX - offset.x, window.innerWidth - container.offsetWidth));
            let newY = Math.max(0, Math.min(e.clientY - offset.y, window.innerHeight - container.offsetHeight));
            container.style.left = newX + "px";
            container.style.top = newY + "px";
            container.style.bottom = "auto";
            container.style.right = "auto";
        });
        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                localStorage.setItem('mapSyncLite_pos', JSON.stringify({ left: container.style.left, top: container.style.top, right: "auto" }));
            }
        });
    }

    setInterval(updateUI, 1000);
    init();
})();
