(function() {
    'use strict';

    const BACKEND_URL = "https://margone-api.onrender.com";
    const CLIENT_ID = "1488794373775687782";
    const REDIRECT_URI = encodeURIComponent(window.location.origin + window.location.pathname);
    const DISCORD_AUTH_URL = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=token&scope=identify%20guilds.members.read`;

    let heartbeatInterval = null;
    let socket = null;
    let cachedData = {};
    let discordToken = localStorage.getItem('mapSync_dcToken');
    let currentMyId = null;

    // --- Logika Tokena ---
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

    function showLoginModal() {
        const existing = document.getElementById('mapSyncLoginOverlay');
        if (existing) return;
        const overlay = document.createElement('div');
        overlay.id = "mapSyncLoginOverlay";
        overlay.style = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px); font-family:Verdana,sans-serif;`;
        overlay.innerHTML = `
            <div style="background:#2f3136; padding:30px; border-radius:12px; text-align:center; border:1px solid #5865f2; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
                <div style="color:#fff; font-size:20px; margin-bottom:15px; font-weight:bold;">Wymagana Autoryzacja</div>
                <p style="color:#b9bbbe; font-size:13px; margin-bottom:25px;">Zaloguj się przez Discord, aby uzyskać dostęp do map.</p>
                <button id="dcLoginBtn" style="background:#5865f2; color:#fff; border:none; padding:12px 25px; border-radius:5px; cursor:pointer; font-weight:bold; font-size:14px; transition:0.2s;">
                    Połącz z Discordem
                </button>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('dcLoginBtn').onclick = () => { window.location.href = DISCORD_AUTH_URL; };
    }

    // --- WebSocket ---
    function initSocket() {
        if (!discordToken) {
            showLoginModal();
            return;
        }

        const wsUrl = BACKEND_URL.replace("http", "ws") + `?token=${discordToken}`;
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            const loginOverlay = document.getElementById('mapSyncLoginOverlay');
            if (loginOverlay) loginOverlay.remove();
            startHeartbeat();
            setInterval(autoMapCheck, 1000);
        };

        socket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'init_data') {
                cachedData = msg.data || {};
                render();
            }
            else if (msg.type === 'cell_updated') {
                cachedData[msg.id] = { val: msg.val, ts: msg.ts };
                updateMapColors();
            }
            else if (msg.type === 'global_alert') {
                showGlobalModal(msg.data);
            }
        };

        socket.onclose = (e) => {
            if (e.code === 4001) {
                localStorage.removeItem('mapSync_dcToken');
                showLoginModal();
            } else {
                setTimeout(initSocket, 5000);
            }
        };
    }

    async function sync(id, val) {
        if (socket && socket.readyState === 1) {
            socket.send(JSON.stringify({
                type: 'update_cell',
                id: id,
                val: val,
                ts: val !== "" ? Date.now() : 0
            }));
        }
    }

    async function sendGlobalAlert(mapName) {
        if (socket && socket.readyState === 1) {
            const data = {
                text: `Potrzebna pomoc na mapie: <b style="color:red">${mapName}</b>`,
                sender: getHeroName(),
                ts: Date.now()
            };
            socket.send(JSON.stringify({ type: 'send_alert', data }));
        }
    }

    let arkusz1 = [];
    let arkusz2 = [];
    let arkusz3 = [];

    async function loadData() {
        try {
            const response = await fetch('data.json');
            const config = await response.json();
            arkusz1 = config.columns.find(c => c.id === 'p')?.maps || [];
            arkusz2 = config.columns.find(c => c.id === 'n')?.maps || [];
            arkusz3 = config.columns.find(c => c.id === 's')?.maps || [];
            render();
            updateBtn();
            initSocket();
        } catch (e) { console.error("JSON error", e); }
    }

    function showGlobalModal(data) {
        if (!data || !data.text) return;
        const existing = document.getElementById('globalAlertModal');
        if (existing) existing.remove();
        const modal = document.createElement('div');
        modal.id = "globalAlertModal";
        modal.style = `position: fixed; top: 15%; left: 50%; transform: translateX(-50%); background: rgba(20, 20, 20, 0.9); color: white; padding: 12px 25px; z-index: 30000; border-radius: 4px; font-family: 'Verdana', sans-serif; text-align: center; border-left: 4px solid #e74c3c; box-shadow: 0 4px 15px rgba(0,0,0,0.5); backdrop-filter: blur(5px); pointer-events: none; border-bottom: 1px solid rgba(255,255,255,0.1);`;
        modal.innerHTML = `<div style="font-size: 10px; opacity: 0.6; margin-bottom: 2px;">WEZWANIE: ${data.sender}</div><div style="font-size: 13px; letter-spacing: 0.5px;">${data.text}</div>`;
        document.body.appendChild(modal);
        setTimeout(() => { modal.style.transition = "opacity 0.8s"; modal.style.opacity = "0"; setTimeout(() => modal.remove(), 800); }, 5000);
    }

    function getHeroName() {
        const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        if (win.Engine && win.Engine.hero && win.Engine.hero.d) return win.Engine.hero.d.nick;
        if (win.hero && win.hero.nick) return win.hero.nick;
        return "???";
    }

    // --- Budowa Kontenera ---
    const savedPos = JSON.parse(localStorage.getItem('mapSyncPos')) || { top: "5px", right: "5px", left: "auto" };
    const savedSize = JSON.parse(localStorage.getItem('mapSyncSize')) || { width: "280px", height: "400px" };
    const isSavedMinimized = localStorage.getItem('mapSyncMinimized') !== 'false';

    const container = document.createElement('div');
    container.id = "mapSyncContainer";
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        #mapSyncScroll::-webkit-scrollbar { width: 4px !important; }
        #mapSyncScroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.2) !important; }
        #mapSyncScroll::-webkit-scrollbar-thumb { background: #555 !important; border-radius: 10px !important; }
        #mapSyncContainer.minimized { width: 150px !important; height: 28px !important; resize: none !important; border-radius: 8px !important; }

        .nav-btn { cursor:pointer; background:none; border:none; font-size:10px; font-weight:bold; color: rgba(255,255,255,0.5); padding: 4px 8px; transition: all 0.2s; position: relative; letter-spacing: 0.5px; }
        .nav-btn.active { color: #fff; }
        .nav-btn.active::after { content: ''; position: absolute; bottom: -2px; left: 8px; right: 8px; height: 2px; background: #fff; border-radius: 2px; }

        .map-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 5px 8px;
            margin-bottom: 3px;
            background: rgba(255,255,255,0.05);
            border-radius: 4px;
            font-size: 11px;
            border-left: 3px solid transparent;
            transition: background 0.2s;
            border: 1px solid rgba(255,255,255,0.03);
            cursor: help;
        }
        .map-row:hover { background: rgba(255,255,255,0.1); }
        .m-name-container { display: flex; align-items: center; flex-grow: 1; overflow: hidden; padding-right: 10px; pointer-events: none; }
        .m-occ { font-size: 10px; margin-right: 6px; min-width: 14px; text-align: center; opacity: 0.8; }
        .m-name { color: #ddd; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 1px 1px 1px #000; transition: color 0.2s; }
        .m-timer { font-family: monospace; font-size: 11px; font-weight: bold; color: #666; min-width: 40px; text-align: right; pointer-events: none; }

        /* Grid Mode Styles - Compact Grid Layout */
        #mapSyncContainer.grid-view #mList {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); /* Zwiększono min szerokość z 95px na 120px */
            gap: 4px;
            padding: 1px;
        }
        #mapSyncContainer.grid-view .map-row {
            flex-direction: column;
            align-items: stretch;
            height: auto;
            min-height: 30px;
            padding: 3px 5px;
            margin-bottom: 0;
            text-align: left;
            position: relative;
            justify-content: center;
        }
        #mapSyncContainer.grid-view .m-name-container {
            padding-right: 0;
            margin-bottom: 0;
            flex-direction: row;
            align-items: flex-start;
            width: 100%;
        }
        #mapSyncContainer.grid-view .m-name {
            white-space: normal;
            line-height: 1.1;
            word-break: break-word;
            font-size: 8.5px;
            display: block; /* Zmieniono z -webkit-box na block, aby nie ucinało linii */
            overflow: visible; /* Pozwala tekstowi zająć tyle miejsca, ile potrzebuje */
            width: calc(100% - 15px); /* Zostawia miejsce na ikonkę 👤 */
        }
        #mapSyncContainer.grid-view .m-timer {
            position: absolute;
            bottom: 2px;
            right: 4px;
            font-size: 8px;
            opacity: 0.7;
            min-width: unset;
        }
        #mapSyncContainer.grid-view .m-occ {
            position: absolute;
            top: 2px;
            right: 2px;
            font-size: 8px;
            margin: 0;
            opacity: 0.8;
        }
        #mapSyncContainer.grid-view .group-sep {
            grid-column: 1 / -1;
            margin: 3px 0 1px 0;
            height: 1px;
            opacity: 0.4;
        }

        .group-sep {
            width: 100%;
            height: 1px;
            background: rgba(255,255,255,0.1);
            margin: 8px 0 5px 0;
        }
        #msCustomTooltip {
            position: fixed;
            z-index: 100000;
            background: rgba(0, 0, 0, 0.9);
            color: #fff;
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 11px;
            pointer-events: none;
            display: none;
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            white-space: nowrap;
            font-family: Verdana, sans-serif;
        }
    `;
    document.head.appendChild(styleSheet);

    const tooltip = document.createElement('div');
    tooltip.id = "msCustomTooltip";
    document.body.appendChild(tooltip);

    container.style = `min-height: 25px; min-width: 160px; position: fixed; top: ${savedPos.top}; right: ${savedPos.right}; left: ${savedPos.left}; width: ${savedSize.width}; height: ${savedSize.height}; z-index: 10000; background: rgba(10, 10, 10, 0.85); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); color: #fff; padding: 6px; border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; font-family: 'Verdana', sans-serif; box-shadow: 0 8px 32px rgba(0,0,0,0.6); user-select: none; display: flex; flex-direction: column; resize: both; overflow: hidden;`;
    container.innerHTML = `
        <div id="dragHandle" style="display:flex; justify-content:space-between; align-items:center; cursor: move; margin-bottom:8px; padding: 2px 6px; flex-shrink: 0;">
            <div id="tabsHeader" style="display:flex; gap:6px;">
                <button id="t1" class="nav-btn active">173h</button>
                <button id="t2" class="nav-btn">231p</button>
                <button id="t3" class="nav-btn">266b</button>
            </div>
            <div id="miniTitle" style="display:none; font-size:10px; font-weight:bold; color:#fff; text-shadow: 0 0 5px #5865f2;">Wielkanoc 2026</div>
            <div id="min" style="cursor:pointer; font-size:18px; color:rgba(255,255,255,0.4); font-weight: bold; line-height: 1;">−</div>
        </div>
        <div id="mapSyncScroll" style="flex-grow: 1; overflow-y: auto; overflow-x: hidden; padding-right: 2px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 6px;">
            <div id="mList"></div>
        </div>
    `;
    document.body.appendChild(container);

    const mList = document.getElementById('mList');
    const scrollArea = document.getElementById('mapSyncScroll');
    let currentTab = 1;

    scrollArea.onwheel = (e) => {
        const atTop = scrollArea.scrollTop === 0;
        const atBottom = scrollArea.scrollHeight - scrollArea.scrollTop === scrollArea.clientHeight;
        if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) return;
        e.stopPropagation();
    };

    function applyMinState(isMin) {
        if (isMin) container.classList.add('minimized');
        else container.classList.remove('minimized');

        scrollArea.style.display = isMin ? 'none' : 'block';
        document.getElementById('tabsHeader').style.display = isMin ? 'none' : 'flex';
        document.getElementById('miniTitle').style.display = isMin ? 'block' : 'none';
        document.getElementById('min').innerText = isMin ? "+" : "−";
        localStorage.setItem('mapSyncMinimized', isMin);
    }

    applyMinState(isSavedMinimized);

    function render() {
        mList.innerHTML = "";
        let data, prefix;
        if (currentTab === 1) { data = arkusz1; prefix = "p"; }
        else if (currentTab === 2) { data = arkusz2; prefix = "n"; }
        else { data = arkusz3; prefix = "s"; }

        let lastColor = null;

        data.forEach((mapData, i) => {
            if (lastColor !== null && mapData[1] !== lastColor) {
                const sep = document.createElement('div');
                sep.className = "group-sep";
                mList.appendChild(sep);
            }
            lastColor = mapData[1];

            const row = document.createElement('div');
            row.className = "map-row";
            row.style.borderLeftColor = mapData[1];
            row.id = `row_${prefix}${i}`;
            row.setAttribute('data-ids', JSON.stringify([`${prefix}${i}_1`, `${prefix}${i}_2`]));

            row.innerHTML = `
                <div class="m-name-container">
                    <span class="m-occ" id="occ_${prefix}${i}"></span>
                    <span class="m-name">${mapData[0]}</span>
                </div>
                <span class="m-timer" id="timer_${prefix}${i}">--:--</span>
            `;

            row.onmouseenter = (e) => {
                const occupants = getRowOccupants(row);
                tooltip.innerHTML = occupants.length > 0 ? "Gracze: <span style='color:#2ecc71; font-weight:bold;'>" + occupants.join(", ") + "</span>" : "Brak graczy na mapie";
                tooltip.style.display = "block";
            };
            row.onmousemove = (e) => {
                tooltip.style.left = (e.clientX + 15) + "px";
                tooltip.style.top = (e.clientY + 15) + "px";
            };
            row.onmouseleave = () => {
                tooltip.style.display = "none";
            };

            row.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                sendGlobalAlert(mapData[0]);
                return false;
            };

            mList.appendChild(row);
        });
        updateMapColors();
    }

    function getRowOccupants(row) {
        const ids = JSON.parse(row.getAttribute('data-ids'));
        const d1 = cachedData[ids[0]] || { val: "" };
        const d2 = cachedData[ids[1]] || { val: "" };
        let occupants = [];
        if (d1.val) occupants.push(d1.val);
        if (d2.val) occupants.push(d2.val);
        return occupants;
    }

    function updateMapColors() {
        const now = Date.now();
        document.querySelectorAll('.map-row').forEach(row => {
            const ids = JSON.parse(row.getAttribute('data-ids'));
            const d1 = cachedData[ids[0]] || { val: "", ts: 0 };
            const d2 = cachedData[ids[1]] || { val: "", ts: 0 };
            const lastTs = Math.max(d1.ts, d2.ts);

            const timerSpan = row.querySelector('.m-timer');
            const nameSpan = row.querySelector('.m-name');
            const occSpan = row.querySelector('.m-occ');

            let occupants = [];
            if (d1.val) occupants.push(d1.val);
            if (d2.val) occupants.push(d2.val);

            if (occupants.length === 1) occSpan.innerText = "👤";
            else if (occupants.length === 2) occSpan.innerText = "👥";
            else occSpan.innerText = "";

            if (lastTs > 0) {
                const diff = Math.max(0, (now - lastTs) / 1000);
                const min = Math.floor(diff / 60);
                const sec = Math.floor(diff % 60).toString().padStart(2, '0');
                timerSpan.innerText = `${min}:${sec}`;

                if (diff < 60) {
                    timerSpan.style.color = "#2ecc71";
                    nameSpan.style.color = "#fff";
                } else if (diff < 150) {
                    timerSpan.style.color = "#f1c40f";
                    nameSpan.style.color = "#ddd";
                } else {
                    timerSpan.style.color = "#e74c3c";
                    nameSpan.style.color = "#888";
                }
            } else {
                timerSpan.innerText = "--:--";
                timerSpan.style.color = "#444";
                nameSpan.style.color = "#555";
            }
        });
    }

    let isDragging = false, offset = { x: 0, y: 0 };
    const dH = document.getElementById('dragHandle');
    dH.onmousedown = (e) => { if (e.target.tagName === 'BUTTON' || e.target.id === 'min') return; isDragging = true; const rect = container.getBoundingClientRect(); offset = { x: e.clientX - rect.left, y: e.clientY - rect.top }; };

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const vW = window.innerWidth, vH = window.innerHeight;
        const cW = container.offsetWidth, cH = container.offsetHeight;
        let newX = e.clientX - offset.x;
        let newY = e.clientY - offset.y;

        if (newX < 0) newX = 0;
        if (newY < 0) newY = 0;
        if (newX + cW > vW) newX = vW - cW;
        if (newY + cH > vH) newY = vH - cH;

        container.style.right = "auto";
        container.style.left = newX + "px";
        container.style.top = newY + "px";
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            localStorage.setItem('mapSyncPos', JSON.stringify({ top: container.style.top, left: container.style.left, right: "auto" }));
        }
    });

    new ResizeObserver((entries) => {
        for (let entry of entries) {
            const width = entry.contentRect.width;
            if (width > 330) {
                container.classList.add('grid-view');
            } else {
                container.classList.remove('grid-view');
            }

            if (!container.classList.contains('minimized')) {
                localStorage.setItem('mapSyncSize', JSON.stringify({ width: container.style.width, height: container.style.height }));
            }
        }
    }).observe(container);

    document.getElementById('min').onclick = () => {
        const isMinNow = !container.classList.contains('minimized');
        applyMinState(isMinNow);
    };

    document.getElementById('t1').onclick = () => { currentTab = 1; render(); updateBtn(); };
    document.getElementById('t2').onclick = () => { currentTab = 2; render(); updateBtn(); };
    document.getElementById('t3').onclick = () => { currentTab = 3; render(); updateBtn(); };

    function updateBtn() {
        document.getElementById('t1').classList.toggle('active', currentTab === 1);
        document.getElementById('t2').classList.toggle('active', currentTab === 2);
        document.getElementById('t3').classList.toggle('active', currentTab === 3);
    }

    function autoMapCheck() {
        const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        let currentMap = win.Engine?.map?.d?.name || win.map?.name || "???";

        if (currentMap === "???" || currentMap === "") return;
        const myNick = getHeroName();

        let foundMatch = false;
        [arkusz1, arkusz2, arkusz3].forEach((arkusz, idx) => {
            const prefix = ["p", "n", "s"][idx];
            arkusz.forEach((mapData, i) => {
                if (mapData[0] === currentMap) {
                    foundMatch = true;
                    const id1 = `${prefix}${i}_1`, id2 = `${prefix}${i}_2`;

                    const d1 = cachedData[id1] || { val: "", ts: 0 };
                    const d2 = cachedData[id2] || { val: "", ts: 0 };

                    if (d1.val === myNick) {
                        currentMyId = id1;
                    } else if (d2.val === myNick) {
                        currentMyId = id2;
                    }
                    else if (!d1.val || d1.val === "") {
                        currentMyId = id1;
                        sync(id1, myNick);
                    }
                    else if (!d2.val || d2.val === "") {
                        currentMyId = id2;
                        sync(id2, myNick);
                    }
                    else {
                        const targetId = (d1.ts <= d2.ts) ? id1 : id2;
                        currentMyId = targetId;
                        sync(targetId, myNick);
                    }
                }
            });
        });

        if (!foundMatch) currentMyId = null;
    }

    function startHeartbeat() {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
            if (socket && socket.readyState === 1 && currentMyId) {
                socket.send(JSON.stringify({
                    type: 'heartbeat',
                    nick: getHeroName(),
                    id: currentMyId
                }));
            }
        }, 1000);
    }

    setInterval(updateMapColors, 1000);
    
    // START
    loadData();

})();