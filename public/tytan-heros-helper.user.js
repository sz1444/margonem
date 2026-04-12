// ==UserScript==
// @name         Tytan Helper BETA
// @namespace    http://tampermonkey.net/
// @version      10.5
// @description  Tytan Helper BETA
// @author       Groli
// @match         *://*.margonem.pl/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- KONFIGURACJA MAP ---
    const MAP_CONFIG = [
        { name: "Sala Tronowa", monster: "Tanroth", icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/ice_king.gif", fallbackId: "p2758" },
        { name: "Sala Zrujnowanej Świątyni", monster: "Barbatos", icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/hebrehoth_smokoludzie.gif", fallbackId: "p238" },
        { name: "Teotihuacan", monster: "Tezcatlipoca", icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/tezcatlipoca.gif", fallbackId: "n166" },
        { name: "Nora Jaszczurzych Koszmarów - źródło", monster: "Maddok Magua", icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/maddok_magua-1a.gif", fallbackId: "s85" },
        { name: "Komnata Krwawych Obrzędów", monster: "Przyzywacz Demonów", icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/przyz_demon_sekta.gif", fallbackId: "p157" },
        { name: "Źródło Wspomnień", monster: "Łowczyni Wspomnień", icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/lowcz-wspo-driady.gif", fallbackId: "p211" },
        { name: "Lokum Złych Goblinów - pracownia", monster: "Versus Zoons", icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/versus-zoons.gif", fallbackId: "p182" },
        { name: "Wulkan Politraki - Piekielne Czeluście", monster: "Piekielny Arcymag", icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/archdemon.gif", fallbackId: "p251" },
        { name: "Bandyckie Chowisko - skarbiec", monster: "Renegat Baulus", icon: "https://micc.garmory-cdn.cloud/obrazki/npc/tyt/renegat_baulus.gif", fallbackId: "p172" },
    ];

    const DEFAULT_ALERTS = [
        { code: "Digit1", label: "WOŁAJ", msg: '<b style="color:#e74c3c">Dawać odbijamy!</b>' },
        { code: "Digit2", label: "ŁAPAĆ", msg: '<b style="color:#e74c3c">Łapać ich!</b>' },
        { code: "Digit3", label: "DOBIJAĆ", msg: '<b style="color:#e74c3c">Dobijać!</b>' },
        { code: "Digit4", label: "WCHODZIMY", msg: '<b style="color:#e74c3c">Wchodzimy!</b>' },
        { code: "Digit5", label: "STOP", msg: '<b style="color:#e74c3c">STOP!</b>' }
    ];

    let quickAlerts = JSON.parse(localStorage.getItem('msLite_customAlerts')) || DEFAULT_ALERTS;
    let hiddenMonsters = JSON.parse(localStorage.getItem('msLite_hidden')) || [];

    const BACKEND_URL = "https://margone-api.onrender.com";
    const CLIENT_ID = "1488794373775687782";

    let socket = null, cachedData = {}, currentMyId = null;
    let discordToken = localStorage.getItem('mapSync_dcToken');
    let mapMapping = {}, isInitialized = false;
    let selectedMonster = null;

    const playPing = () => {
        try {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const osc = context.createOscillator();
            const gain = context.createGain();
            osc.connect(gain); gain.connect(context.destination);
            osc.type = "sine"; osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.05, context.currentTime);
            osc.start(); osc.stop(context.currentTime + 0.2);
        } catch(e) {}
    };

    const savedPos = JSON.parse(localStorage.getItem('mapSyncLite_pos')) || { top: "5px", left: "auto", right: "5px" };
    const savedSize = JSON.parse(localStorage.getItem('msLite_size')) || { width: "164px", height: "200px" };
    let isCollapsed = localStorage.getItem('mapSyncLite_collapsed') === 'true';

    const style = document.createElement('style');
    style.innerText = `
        #msLiteContainer {
            position: fixed; z-index: 10001; user-select: none;
            display: flex; flex-direction: column; background: rgba(10, 10, 10, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 10px;
            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.6); font-family: 'Verdana', sans-serif;
            overflow: hidden;
            min-width: 150px; min-height: 24px;
        }
        #msLiteHeader {
            display: flex; justify-content: space-between; align-items: center;
            padding: 4px 8px; cursor: grab; background: rgb(18 17 17);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05); flex-shrink: 0;
            height: 24px; box-sizing: border-box;
        }
        #msLiteHeader:active { cursor: grabbing; }
        #msLiteTitle { font-size: 10px; font-weight: bold; color: #fff; text-shadow: 0 0 5px #5865f2; letter-spacing: 0.5px; pointer-events: none; }
        #msLiteControls { display: flex; align-items: center; gap: 8px; }
        #msLiteRestore { cursor: pointer; font-size: 12px; color: #5865f2; display: none; transition: transform 0.2s; }
        #msLiteRestore:hover { transform: scale(1.2); }
        #msLiteToggle { cursor: pointer; font-size: 18px; color: rgba(255,255,255,0.4); font-weight: bold; line-height: 1; transition: color 0.2s; }
        #msLiteToggle:hover { color: #fff; }

        #msLiteContent {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(46px, 1fr));
            align-content: start;
            gap: 4px;
            padding: 6px;
            overflow-y: auto;
            flex: 1;
            min-height: 0;
            pointer-events: auto;
        }

        #msLiteContent::-webkit-scrollbar { width: 3px; }
        #msLiteContent::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        #msLiteContent::-webkit-scrollbar-thumb { background: rgba(88, 101, 242, 0.6); border-radius: 10px; }
        #msLiteContent::-webkit-scrollbar-thumb:hover { background: rgba(88, 101, 242, 0.9); }

        .ms-lite-item {
            position: relative; display: flex; flex-direction: column; align-items: center;
            padding: 4px; background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.03); border-radius: 6px; transition: 0.2s;
            cursor: pointer;
            height: 58px;
            box-sizing: border-box;
            justify-content: center;
        }
        .ms-lite-item:hover { background: rgba(255, 255, 255, 0.1); }
        .ms-selected { border-color: #5865f2 !important; background: rgba(88, 101, 242, 0.15) !important; box-shadow: inset 0 0 8px rgba(88, 101, 242, 0.3); }
        .ms-alert-flash { background: rgba(231, 76, 60, 0.4) !important; border-color: rgba(231, 76, 60, 0.8) !important; }
        .ms-lite-img { width: 32px; height: 32px; background-size: contain; background-repeat: no-repeat; background-position: center; filter: drop-shadow(1px 1px 1px #000); }
        .ms-lite-timer { font-size: 10px; font-weight: bold; font-family: monospace; color: #666; text-shadow: 1px 1px 1px #000; margin-top: 2px; z-index: 3; pointer-events: none; }

        .ms-is-not-resping { opacity: 0.4; filter: grayscale(1); }

        /* --- STANDARDOWY WYGLĄD ROGU RESIZE --- */
        #msLiteResizeHandle {
            position: absolute; bottom: 2px; right: 2px; width: 10px; height: 10px;
            cursor: se-resize; z-index: 10002;
            background: repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.2) 3px, rgba(255,255,255,0.2) 4px);
            clip-path: polygon(100% 0, 100% 100%, 0 100%);
        }

        #msLiteCtxMenu {
            position: fixed; display: none; z-index: 20002; background: rgba(20, 20, 20, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; padding: 3px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5); backdrop-filter: blur(5px); min-width: 120px;
            font-family: 'Verdana', sans-serif;
        }
        .ms-ctx-item { padding: 6px 12px; font-size: 10px; font-weight: bold; color: #eee; cursor: pointer; border-radius: 2px; transition: 0.2s; }
        .ms-ctx-item:hover { background: rgba(255, 255, 255, 0.1); color: #5865f2; }
        .ms-ctx-danger { color: #e74c3c !important; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 4px; }

        .ms-lite-alert-box {
            position: fixed; top: 15%; left: 50%; transform: translateX(-50%);
            background: rgba(20, 20, 20, 0.95); color: white; padding: 12px 25px;
            z-index: 30000; border-radius: 4px; text-align: center; border-left: 4px solid #e74c3c;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5); backdrop-filter: blur(5px); pointer-events: none;
            min-width: 200px; max-width: 80vw; line-height: 1.4;
        }
    `;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.id = "msLiteContainer";

    const initialHeight = isCollapsed ? 'auto' : savedSize.height;
    Object.assign(container.style, {
        top: savedPos.top, left: savedPos.left, right: savedPos.right,
        width: savedSize.width, height: initialHeight
    });

    container.innerHTML = `
        <div id="msLiteHeader">
            <div id="msLiteTitle">Tytan Helper</div>
            <div id="msLiteControls">
                <div id="msLiteRestore" title="Pokaż wszystkie ukryte sloty">👁</div>
                <div id="msLiteToggle">${isCollapsed ? '+' : '−'}</div>
            </div>
        </div>
        <div id="msLiteContent" style="display: ${isCollapsed ? 'none' : 'grid'};"></div>
        <div id="msLiteResizeHandle" style="display: ${isCollapsed ? 'none' : 'block'};"></div>
    `;
    document.body.appendChild(container);

    const ctxMenu = document.createElement('div');
    ctxMenu.id = "msLiteCtxMenu";
    document.body.appendChild(ctxMenu);

    function getHeroName() {
        const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        return (win.Engine?.hero?.d?.nick || win.hero?.nick || "???");
    }

    function sendAlert(monster, message) {
        if (socket?.readyState === 1) {
            const data = { text: `<b style="color:white">[${monster}]</b> ${message}`, sender: getHeroName(), ts: Date.now() };
            socket.send(JSON.stringify({ type: 'send_alert', data }));
            flashCardByMonster(monster);
        }
        ctxMenu.style.display = "none";
    }

    function flashCardByMonster(monsterName) {
        document.querySelectorAll('.ms-lite-item').forEach(item => {
            if (item.getAttribute('data-monster') === monsterName) {
                item.classList.add('ms-alert-flash');
                setTimeout(() => item.classList.remove('ms-alert-flash'), 1500);
            }
        });
    }

    function showGlobalAlert(data) {
        if (!data?.text) return;
        MAP_CONFIG.forEach(map => { if (data.text.includes(`[${map.monster}]`)) flashCardByMonster(map.monster); });
        if (document.getElementById('globalAlertModal') || document.getElementById('mapSyncContainer')) return;
        playPing();
        const alert = document.createElement('div');
        alert.id = "globalAlertModal";
        alert.className = "ms-lite-alert-box";
        alert.innerHTML = `<div style="font-size: 10px; opacity: 0.6; margin-bottom: 2px;">${data.sender}</div><div style="font-size: 13px; letter-spacing: 0.5px;">${data.text}</div>`;
        document.body.appendChild(alert);
        setTimeout(() => { alert.style.opacity = "0"; setTimeout(() => alert.remove(), 800); }, 5000);
    }

    function showAllMonsters() {
        hiddenMonsters = [];
        localStorage.setItem('msLite_hidden', JSON.stringify([]));
        render();
    }

    window.addEventListener('keydown', (e) => {
        const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
        const hasModifier = e.altKey || e.metaKey;
        if (isTyping || !selectedMonster || !hasModifier) return;
        const alert = quickAlerts.find(a => a.code === e.code);
        if (alert) { e.preventDefault(); sendAlert(selectedMonster, alert.msg); }
    });

    async function init() {
        render(); setupDragging(); setupToggle(); setupHeaderContext(); setupResizing();
        try {
            const response = await fetch('https://margonem.vercel.app/data.json');
            const config = await response.json();
            mapMapping = {};
            config.columns.forEach(col => {
                col.maps.forEach((m, index) => {
                    const cleanName = m[0].toLowerCase().trim();
                    MAP_CONFIG.forEach(mc => { if(mc.name.toLowerCase() === cleanName) mapMapping[cleanName] = { id: `${col.id}${index}` }; });
                });
            });
            MAP_CONFIG.forEach(map => { if (!mapMapping[map.name.toLowerCase()]) mapMapping[map.name.toLowerCase()] = { id: map.fallbackId }; });
            isInitialized = true; render();
            if (discordToken) connectWS(); else showLoginButton();
        } catch (e) {
            MAP_CONFIG.forEach(map => { mapMapping[map.name.toLowerCase()] = { id: map.fallbackId }; });
            isInitialized = true; render();
            if (discordToken) connectWS(); else showLoginButton();
        }
    }

    function setupToggle() {
        const toggle = document.getElementById('msLiteToggle'), content = document.getElementById('msLiteContent');
        const handle = document.getElementById('msLiteResizeHandle');
        toggle.onclick = (e) => {
            e.stopPropagation(); isCollapsed = !isCollapsed;
            content.style.display = isCollapsed ? 'none' : 'grid';
            handle.style.display = isCollapsed ? 'none' : 'block';
            toggle.innerText = isCollapsed ? '+' : '−';
            localStorage.setItem('mapSyncLite_collapsed', isCollapsed);
            if (isCollapsed) { container.style.height = 'auto'; } else {
                const currentSavedSize = JSON.parse(localStorage.getItem('msLite_size')) || savedSize;
                container.style.height = currentSavedSize.height;
            }
        };
        document.getElementById('msLiteRestore').onclick = (e) => { e.stopPropagation(); showAllMonsters(); };
    }

    function setupHeaderContext() {
        document.getElementById('msLiteHeader').oncontextmenu = (e) => {
            e.preventDefault(); e.stopPropagation();
            ctxMenu.innerHTML = `<div style="font-size:9px; color:#888; text-align:center; padding:3px; border-bottom:1px solid rgba(255,255,255,0.1);">Opcje Panelu</div>`;
            const showBtn = document.createElement('div');
            showBtn.className = "ms-ctx-item"; showBtn.innerText = "POKAŻ WSZYSTKO";
            showBtn.onclick = () => { showAllMonsters(); ctxMenu.style.display = "none"; };
            ctxMenu.appendChild(showBtn);
            ctxMenu.style.left = e.clientX + "px"; ctxMenu.style.top = e.clientY + "px"; ctxMenu.style.display = "block";
            const close = () => { ctxMenu.style.display = "none"; document.removeEventListener('click', close); };
            setTimeout(() => document.addEventListener('click', close), 10);
        };
    }

    function showLoginButton() {
        const content = document.getElementById('msLiteContent');
        if (document.getElementById('msLiteLogin') || isCollapsed || !content) return;
        const btn = document.createElement('div');
        btn.id = "msLiteLogin"; btn.style = "grid-column: 1 / -1; font-size:11px; background: #5865f2; padding: 6px; border-radius: 4px; cursor: pointer; text-align:center; color: white; font-weight: 600; margin-top: 4px;";
        btn.innerText = "Połącz konto";
        btn.onclick = () => window.location.href = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(window.location.origin + window.location.pathname)}&response_type=token&scope=identify%20guilds.members.read`;
        content.appendChild(btn);
    }

    function connectWS() {
        if (!discordToken) return;
        socket = new WebSocket(BACKEND_URL.replace("http", "ws") + `?token=${discordToken}`);
        socket.onmessage = (e) => {
            const msg = JSON.parse(e.data);
            if (msg.type === 'init_data') { cachedData = msg.data || {}; updateUI(); }
            else if (msg.type === 'cell_updated') { cachedData[msg.id] = { val: msg.val, ts: msg.ts }; updateUI(); }
            else if (msg.type === 'global_alert') showGlobalAlert(msg.data);
            else if (msg.type === 'auth_error') { localStorage.removeItem('mapSync_dcToken'); showLoginButton(); }
        };
        socket.onclose = () => setTimeout(connectWS, 5000);
        setInterval(autoCheck, 1000);
    }

    function autoCheck() {
        if (!isInitialized || socket?.readyState !== 1) return;
        const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        if ((win.Engine?.hero?.checkStasis && win.Engine.hero.checkStasis() !== 0) || (win.hero?.stasis > 0)) { currentMyId = null; return; }
        const mapName = (win.Engine?.map?.d?.name || win.map?.name || "???").toLowerCase();
        const mapData = mapMapping[mapName], myNick = getHeroName();
        if (mapData) {
            const id1 = `${mapData.id}_1`, id2 = `${mapData.id}_2`;
            const d1 = cachedData[id1] || { val: "" }, d2 = cachedData[id2] || { val: "" };
            if (d1.val === myNick) currentMyId = id1;
            else if (d2.val === myNick) currentMyId = id2;
            else if (!d1.val) { currentMyId = id1; sync(id1, myNick); }
            else { currentMyId = id2; sync(id2, myNick); }
            if (currentMyId) {
                cachedData[currentMyId] = { val: myNick, ts: Date.now() };
                socket.send(JSON.stringify({ type: 'heartbeat', nick: myNick, id: currentMyId }));
                updateUI();
            }
        } else currentMyId = null;
    }

    function sync(id, val) { if (socket?.readyState === 1) socket.send(JSON.stringify({ type: 'update_cell', id, val, ts: val ? Date.now() : 0 })); }

    function render() {
        const content = document.getElementById('msLiteContent'); if (!content) return;
        const restoreBtn = document.getElementById('msLiteRestore');
        if (restoreBtn) restoreBtn.style.display = hiddenMonsters.length > 0 ? 'block' : 'none';
        content.onwheel = (e) => e.stopPropagation();
        const visibleMaps = MAP_CONFIG.filter(m => !hiddenMonsters.includes(m.monster));
        content.innerHTML = visibleMaps.map(map => {
            const data = mapMapping[map.name.toLowerCase()] || { id: `wait_${map.monster}` };
            return `<div class="ms-lite-item ${selectedMonster === map.monster ? 'ms-selected' : ''}" data-monster="${map.monster}" id="card_${data.id}" title="${map.name}"><div class="ms-lite-img" style="background-image: url('${map.icon}');"></div><span class="ms-lite-timer" id="lt_${data.id}">--:--</span></div>`;
        }).join('');
        content.querySelectorAll('.ms-lite-item').forEach(item => {
            const monster = item.getAttribute('data-monster');
            item.onclick = (e) => { selectedMonster = (selectedMonster === monster) ? null : monster; render(); };
            item.oncontextmenu = (e) => {
                e.preventDefault(); e.stopPropagation();
                ctxMenu.innerHTML = `<div style="font-size:9px; color:#888; text-align:center; padding:3px; border-bottom:1px solid rgba(255,255,255,0.1);">${monster}</div>`;
                quickAlerts.forEach((a, index) => {
                    const btn = document.createElement('div');
                    btn.className = "ms-ctx-item";
                    const keyName = a.code.replace('Digit','').replace('Key','').toUpperCase();
                    btn.innerText = `[A/C+${keyName}] ${a.label}`;
                    btn.onclick = (ev) => { ev.stopPropagation(); sendAlert(monster, a.msg); };
                    btn.oncontextmenu = (ev) => {
                        ev.preventDefault(); ev.stopPropagation();
                        const input = prompt(`Klawisz:`, keyName);
                        if (input) {
                            quickAlerts[index].code = isNaN(input.trim()) ? "Key" + input.trim().toUpperCase() : "Digit" + input.trim();
                            localStorage.setItem('msLite_customAlerts', JSON.stringify(quickAlerts));
                            ctxMenu.style.display = "none"; render();
                        }
                    };
                    ctxMenu.appendChild(btn);
                });
                const hideBtn = document.createElement('div');
                hideBtn.className = "ms-ctx-item ms-ctx-danger"; hideBtn.innerText = "UKRYJ SLOT";
                hideBtn.onclick = () => { hiddenMonsters.push(monster); localStorage.setItem('msLite_hidden', JSON.stringify(hiddenMonsters)); ctxMenu.style.display = "none"; render(); };
                ctxMenu.appendChild(hideBtn);
                let posX = e.clientX; let posY = e.clientY;
                if (posX + 130 > window.innerWidth) posX = window.innerWidth - 130;
                if (posY + 200 > window.innerHeight) posY = window.innerHeight - 200;
                ctxMenu.style.left = posX + "px"; ctxMenu.style.top = posY + "px"; ctxMenu.style.display = "block";
                const close = () => { ctxMenu.style.display = "none"; document.removeEventListener('click', close); };
                setTimeout(() => document.addEventListener('click', close), 10);
            };
        });
        if (!discordToken) showLoginButton();
    }

    function updateUI() {
        const now = Date.now();
        const widget = document.getElementById('ll-timers');
        const bossEntries = widget ? Array.from(widget.querySelectorAll('[data-slot="tooltip-trigger"]')) : [];
        MAP_CONFIG.forEach(map => {
            const data = mapMapping[map.name.toLowerCase()]; if (!data) return;
            const d1 = cachedData[`${data.id}_1`] || { val: "", ts: 0 }, d2 = cachedData[`${data.id}_2`] || { val: "" , ts: 0 };
            const lastTs = Math.max(d1.ts, d2.ts), timerEl = document.getElementById(`lt_${data.id}`), cardEl = document.getElementById(`card_${data.id}`);
            if (!timerEl) return;
            let isRespawning = true;
            if (widget) {
                const bossBlock = bossEntries.find(el => el.textContent.includes(map.monster));
                if (bossBlock) {
                    const hasOrange = bossBlock.classList.contains('ll:text-orange-400') || bossBlock.querySelector('.ll\\:text-orange-400');
                    if (!hasOrange) isRespawning = false;
                }
            }
            if (!isRespawning) {
                timerEl.innerText = "-"; timerEl.style.color = "#666";
                if (cardEl) cardEl.classList.add('ms-is-not-resping');
            } else {
                if (cardEl) cardEl.classList.remove('ms-is-not-resping');
                if (lastTs > 0) {
                    const diff = (now - lastTs) / 1000, min = Math.floor(diff / 60), sec = Math.floor(diff % 60).toString().padStart(2, '0');
                    timerEl.innerText = `${min}:${sec}`;
                    if (diff < 300) timerEl.style.color = "#2ecc71"; else if (diff < 600) timerEl.style.color = "#f1c40f"; else timerEl.style.color = "#e74c3c";
                } else { timerEl.innerText = "--:--"; timerEl.style.color = "#666"; }
            }
        });
    }

    function setupDragging() {
        let isDragging = false, offset = { x: 0, y: 0 };
        container.onmousedown = (e) => {
            if (!e.target.closest('#msLiteHeader')) return;
            if (e.target.id === 'msLiteToggle' || e.target.id === 'msLiteRestore') return;
            isDragging = true; offset.x = e.clientX - container.offsetLeft; offset.y = e.clientY - container.offsetTop;
        };
        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let nX = e.clientX - offset.x, nY = e.clientY - offset.y;
            const maxX = window.innerWidth - container.offsetWidth, maxY = window.innerHeight - container.offsetHeight;
            container.style.left = Math.max(0, Math.min(nX, maxX)) + "px"; container.style.top = Math.max(0, Math.min(nY, maxY)) + "px";
            container.style.right = "auto"; container.style.bottom = "auto";
        });
        window.addEventListener('mouseup', () => { if (isDragging) { isDragging = false; localStorage.setItem('mapSyncLite_pos', JSON.stringify({ left: container.style.left, top: container.style.top, right: "auto" })); } });
    }

    function setupResizing() {
        const handle = document.getElementById('msLiteResizeHandle');
        let isResizing = false;
        handle.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); isResizing = true; };
        window.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const newWidth = Math.max(150, e.clientX - container.offsetLeft);
            const newHeight = Math.max(35, e.clientY - container.offsetTop);
            container.style.width = newWidth + "px"; container.style.height = newHeight + "px";
        });
        window.addEventListener('mouseup', () => {
            if (isResizing) { isResizing = false; localStorage.setItem('msLite_size', JSON.stringify({ width: container.style.width, height: container.style.height })); }
        });
    }

    setInterval(updateUI, 1000);
    init();
})();
